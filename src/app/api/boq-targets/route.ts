import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/boq-targets - List BOQ targets with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type BoqTargetWhere = {
    OR?: { 
      activityId?: { contains: string }; 
      site?: { site: { contains: string } }; 
      boq?: { boqNo: { contains: string } }; 
    }[];
  };
  const where: BoqTargetWhere = {};
  if (search) {
    where.OR = [
      { activityId: { contains: search } },
      { site: { site: { contains: search } } },
      { boq: { boqNo: { contains: search } } },
    ];
  }

  const sortableFields = new Set(["activityId", "fromTargetDate", "toTargetDate", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { createdAt: "desc" };

  const result = await paginate({
    model: prisma.boqTarget,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      siteId: true,
      site: { select: { id: true, site: true } },
      boqId: true,
      boq: { select: { id: true, boqNo: true } },
      activityId: true,
      fromTargetDate: true,
      toTargetDate: true,
      dailyTargetQty: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/boq-targets - Create new BOQ target
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  // Basic validation
  if (typeof b.siteId !== 'number' || b.siteId <= 0) {
    return Error('Valid siteId is required', 400);
  }
  if (typeof b.boqId !== 'number' || b.boqId <= 0) {
    return Error('Valid boqId is required', 400);
  }
  if (typeof b.activityId !== 'string' || !b.activityId.trim()) {
    return Error('Valid activityId is required', 400);
  }
  if (typeof b.fromTargetDate !== 'string' || !b.fromTargetDate) {
    return Error('Valid fromTargetDate is required', 400);
  }
  if (typeof b.toTargetDate !== 'string' || !b.toTargetDate) {
    return Error('Valid toTargetDate is required', 400);
  }
  if (typeof b.dailyTargetQty !== 'string' || !b.dailyTargetQty) {
    return Error('Valid dailyTargetQty is required', 400);
  }

  // Validate date range
  const fromDate = new Date(b.fromTargetDate);
  const toDate = new Date(b.toTargetDate);
  if (fromDate >= toDate) {
    return Error('From target date must be before to target date', 400);
  }

  // Check if site exists
  const site = await prisma.site.findUnique({ where: { id: b.siteId } });
  if (!site) return Error('Site not found', 404);

  // Check if BOQ exists
  const boq = await prisma.boq.findUnique({ where: { id: b.boqId } });
  if (!boq) return Error('BOQ not found', 404);

  // Check if activity exists in the BOQ
  const activity = await prisma.boqItem.findFirst({
    where: { boqId: b.boqId, activityId: b.activityId }
  });
  if (!activity) return Error('Activity not found in the selected BOQ', 404);

  try {
    const boqTarget = await prisma.boqTarget.create({
      data: {
        siteId: b.siteId,
        boqId: b.boqId,
        activityId: b.activityId.trim(),
        fromTargetDate: fromDate,
        toTargetDate: toDate,
        dailyTargetQty: b.dailyTargetQty,
        createdBy: String(auth.user.id),
        updatedBy: String(auth.user.id),
      },
      include: {
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } }
      }
    });
    return Success(boqTarget);
  } catch (err) {
    console.error('Error creating BOQ target:', err);
    return Error('Failed to create BOQ target', 500);
  }
}

// PATCH /api/boq-targets - Update BOQ target
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  if (typeof b.id !== 'number' || b.id <= 0) {
    return Error('Valid id is required', 400);
  }

  // Check if BOQ target exists
  const existing = await prisma.boqTarget.findUnique({ where: { id: b.id } });
  if (!existing) return Error('BOQ Target not found', 404);

  // Prepare update data
  const updateData: any = { updatedBy: String(auth.user.id) };

  if (b.siteId !== undefined) {
    if (typeof b.siteId !== 'number' || b.siteId <= 0) {
      return Error('Valid siteId is required', 400);
    }
    updateData.siteId = b.siteId;
  }

  if (b.boqId !== undefined) {
    if (typeof b.boqId !== 'number' || b.boqId <= 0) {
      return Error('Valid boqId is required', 400);
    }
    updateData.boqId = b.boqId;
  }

  if (b.activityId !== undefined) {
    if (typeof b.activityId !== 'string' || !b.activityId.trim()) {
      return Error('Valid activityId is required', 400);
    }
    updateData.activityId = b.activityId.trim();
  }

  if (b.fromTargetDate !== undefined) {
    if (typeof b.fromTargetDate !== 'string' || !b.fromTargetDate) {
      return Error('Valid fromTargetDate is required', 400);
    }
    updateData.fromTargetDate = new Date(b.fromTargetDate);
  }

  if (b.toTargetDate !== undefined) {
    if (typeof b.toTargetDate !== 'string' || !b.toTargetDate) {
      return Error('Valid toTargetDate is required', 400);
    }
    updateData.toTargetDate = new Date(b.toTargetDate);
  }

  if (b.dailyTargetQty !== undefined) {
    if (typeof b.dailyTargetQty !== 'string' || !b.dailyTargetQty) {
      return Error('Valid dailyTargetQty is required', 400);
    }
    updateData.dailyTargetQty = b.dailyTargetQty;
  }

  // Validate date range
  const fromDate = updateData.fromTargetDate || existing.fromTargetDate;
  const toDate = updateData.toTargetDate || existing.toTargetDate;
  if (fromDate >= toDate) {
    return Error('From target date must be before to target date', 400);
  }

  try {
    const boqTarget = await prisma.boqTarget.update({
      where: { id: b.id },
      data: updateData,
      include: {
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } }
      }
    });
    return Success(boqTarget);
  } catch (err) {
    console.error('Error updating BOQ target:', err);
    return Error('Failed to update BOQ target', 500);
  }
}
