import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// Helper to generate next BOQ number like BOQ-00001
async function generateBoqNo(): Promise<string> {
  // Find last by id desc (fast) and parse numeric suffix
  const last = await prisma.boq.findFirst({
    orderBy: { id: "desc" },
    select: { boqNo: true },
  });
  const prefix = "BOQ-";
  const lastNum = last?.boqNo?.startsWith(prefix)
    ? parseInt(last.boqNo.slice(prefix.length), 10)
    : 0;
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
  const next = `${prefix}${String(nextNum).padStart(5, "0")}`;
  return next;
}

// GET /api/boqs?search=&page=1&perPage=10&sort=createdAt&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(searchParams.get("perPage")) || 10)
  );
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  type BoqWhere = {
    OR?: { workName?: { contains: string }; boqNo?: { contains: string } }[];
    siteId?: number | { in: number[] };
  };
  const where: BoqWhere = {};
  if (search) {
    where.OR = [
      { workName: { contains: search } },
      { boqNo: { contains: search } },
    ];
  }

  const siteIdParamRaw = searchParams.get("siteId");
  const siteIdParam = siteIdParamRaw ? Number(siteIdParamRaw) : NaN;

  let assignedSiteIds: number[] | null = null;
  if ((auth as any).user?.role !== ROLES.ADMIN) {
    const employee = await prisma.employee.findFirst({
      where: { userId: (auth as any).user?.id },
      select: { siteEmployees: { select: { siteId: true } } },
    });
    assignedSiteIds = (employee?.siteEmployees || [])
      .map((s) => s.siteId)
      .filter((v): v is number => typeof v === "number");
  }

  // Optional filter by siteId for dependent dropdowns
  if (!Number.isNaN(siteIdParam) && siteIdParam > 0) {
    if (assignedSiteIds) {
      (where as any).siteId = assignedSiteIds.includes(siteIdParam)
        ? siteIdParam
        : { in: [-1] };
    } else {
      where.siteId = siteIdParam;
    }
  }

  const sortableFields = new Set(["boqNo", "workName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  // Site-based visibility: only ADMIN can see all; others limited to assigned sites
  if (assignedSiteIds) {
    if ((where as any).siteId === undefined) {
      (where as any).siteId = {
        in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1],
      };
    }
  }

  const result = await paginate({
    model: prisma.boq as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      boqNo: true,
      siteId: true,
      site: { select: { id: true, site: true } },
      workName: true,
      workOrderNo: true,
      totalWorkValue: true,
      gstRate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/boqs  (create BOQ)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const b = (body as Record<string, unknown>) || {};

  // Minimal validation: require workName (can adjust as needed)
  const workName = (b.workName as string | undefined)?.trim();
  const siteId = b.siteId != null ? Number(b.siteId) : null;

  try {
    let created;
    // Generate a unique boqNo with a couple of retries if needed
    for (let i = 0; i < 3; i++) {
      const boqNo = await generateBoqNo();
      try {
        // Prepare items if provided
        const items = Array.isArray(b.items) ? (b.items as any[]) : [];
        const itemsCreate = items.map((it) => {
          const qty = it.qty ?? null;
          const rate = it.rate ?? null;
          const amount =
            it.amount ??
            (qty != null && rate != null
              ? (Number(qty) * Number(rate)).toFixed(2)
              : null);
          const orderedQty = it.orderedQty ?? 0;
          const orderedValue = it.orderedValue ?? null;
          const remainingQty = it.remainingQty ?? null;
          const remainingValue = it.remainingValue ?? null;
          return {
            activityId: it.activityId ?? null,
            clientSrNo: it.clientSrNo ?? null,
            item: it.item ?? null,
            unitId: it.unitId ?? null,
            qty: qty as any,
            rate: rate as any,
            amount: amount as any,
            orderedQty: orderedQty as any,
            orderedValue: orderedValue as any,
            remainingQty: remainingQty as any,
            remainingValue: remainingValue as any,
            isGroup: Boolean(it.isGroup) || false,
          };
        });

        created = await prisma.boq.create({
          data: {
            boqNo,
            siteId: siteId || undefined,
            workName: workName || null,
            workOrderNo: (b.workOrderNo as string | undefined) || null,
            workOrderDate: b.workOrderDate
              ? new Date(String(b.workOrderDate))
              : null,
            startDate: b.startDate ? new Date(String(b.startDate)) : null,
            endDate: b.endDate ? new Date(String(b.endDate)) : null,
            totalWorkValue:
              b.totalWorkValue != null ? (b.totalWorkValue as any) : null,
            gstRate: b.gstRate != null ? (b.gstRate as any) : null,
            agreementNo: (b.agreementNo as string | undefined) || null,
            agreementStatus: (b.agreementStatus as string | undefined) || null,
            completionPeriod:
              (b.completionPeriod as string | undefined) || null,
            completionDate: b.completionDate
              ? new Date(String(b.completionDate))
              : null,
            dateOfExpiry: b.dateOfExpiry
              ? new Date(String(b.dateOfExpiry))
              : null,
            commencementDate: b.commencementDate
              ? new Date(String(b.commencementDate))
              : null,
            timeExtensionDate: b.timeExtensionDate
              ? new Date(String(b.timeExtensionDate))
              : null,
            defectLiabilityPeriod:
              (b.defectLiabilityPeriod as string | undefined) || null,
            performanceSecurityMode:
              (b.performanceSecurityMode as string | undefined) || null,
            performanceSecurityDocumentNo:
              (b.performanceSecurityDocumentNo as string | undefined) || null,
            performanceSecurityPeriod:
              (b.performanceSecurityPeriod as string | undefined) || null,
            ...(itemsCreate.length ? { items: { create: itemsCreate } } : {}),
          },
          select: { id: true, boqNo: true },
        });
        break;
      } catch (e: any) {
        if (e?.code === "P2002") {
          // unique constraint failed; try next number
          continue;
        }
        throw e;
      }
    }
    if (!created) return Error("Failed to create BOQ", 500);

    // Return full object for client
    const full = await prisma.boq.findUnique({
      where: { id: created.id },
      select: { id: true, boqNo: true },
    });
    return Success(full, 201);
  } catch (e: any) {
    const code = e?.code ? ` (${e.code})` : "";
    const msg = typeof e?.message === "string" && e.message ? e.message : "Failed to create BOQ";
    return Error(`${msg}${code}`);
  }
}

// PATCH /api/boqs  { id, ...fields }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const b = (body as Record<string, unknown>) || {};
  const id = b.id != null ? Number(b.id) : NaN;
  if (!id || Number.isNaN(id)) return Error("BOQ id required", 400);

  const data: Record<string, any> = {};
  if (b.siteId !== undefined)
    data.siteId = b.siteId == null ? null : Number(b.siteId);
  if (b.workName !== undefined)
    data.workName = (b.workName as string | null) ?? null;
  if (b.workOrderNo !== undefined)
    data.workOrderNo = (b.workOrderNo as string | null) ?? null;
  if (b.workOrderDate !== undefined)
    data.workOrderDate = b.workOrderDate
      ? new Date(String(b.workOrderDate))
      : null;
  if (b.startDate !== undefined)
    data.startDate = b.startDate ? new Date(String(b.startDate)) : null;
  if (b.endDate !== undefined)
    data.endDate = b.endDate ? new Date(String(b.endDate)) : null;
  if (b.totalWorkValue !== undefined)
    data.totalWorkValue = b.totalWorkValue as any;
  if (b.gstRate !== undefined) data.gstRate = b.gstRate as any;
  if (b.agreementNo !== undefined)
    data.agreementNo = (b.agreementNo as string | null) ?? null;
  if (b.agreementStatus !== undefined)
    data.agreementStatus = (b.agreementStatus as string | null) ?? null;
  if (b.completionPeriod !== undefined)
    data.completionPeriod = (b.completionPeriod as string | null) ?? null;
  if (b.completionDate !== undefined)
    data.completionDate = b.completionDate
      ? new Date(String(b.completionDate))
      : null;
  if (b.dateOfExpiry !== undefined)
    data.dateOfExpiry = b.dateOfExpiry
      ? new Date(String(b.dateOfExpiry))
      : null;
  if (b.commencementDate !== undefined)
    data.commencementDate = b.commencementDate
      ? new Date(String(b.commencementDate))
      : null;
  if (b.timeExtensionDate !== undefined)
    data.timeExtensionDate = b.timeExtensionDate
      ? new Date(String(b.timeExtensionDate))
      : null;
  if (b.defectLiabilityPeriod !== undefined)
    data.defectLiabilityPeriod =
      (b.defectLiabilityPeriod as string | null) ?? null;
  if (b.performanceSecurityMode !== undefined)
    data.performanceSecurityMode =
      (b.performanceSecurityMode as string | null) ?? null;
  if (b.performanceSecurityDocumentNo !== undefined)
    data.performanceSecurityDocumentNo =
      (b.performanceSecurityDocumentNo as string | null) ?? null;
  if (b.performanceSecurityPeriod !== undefined)
    data.performanceSecurityPeriod =
      (b.performanceSecurityPeriod as string | null) ?? null;

  // Allow item-only updates (when no other fields present)
  const incomingItems = Array.isArray(b.items) ? (b.items as any[]) : null;
  if (Object.keys(data).length === 0 && !incomingItems)
    return Error("Nothing to update", 400);

  try {
    // Upsert items in a transaction
    const items = incomingItems;
    const result = await prisma.$transaction(async (tx) => {
      // Ensure BOQ exists and update fields if any
      let updated: { id: number; boqNo: string | null };
      if (Object.keys(data).length > 0) {
        updated = await tx.boq.update({
          where: { id },
          data,
          select: { id: true, boqNo: true },
        });
      } else {
        const found = await tx.boq.findUnique({
          where: { id },
          select: { id: true, boqNo: true },
        });
        if (!found) throw { code: "P2025" } as any;
        updated = found;
      }

      if (items) {
        // Fetch existing item IDs for this BOQ
        const existing = await tx.boqItem.findMany({
          where: { boqId: id },
          select: { id: true },
        });
        const existingIds = new Set(existing.map((e) => e.id));

        const toUpdate = items.filter((it) => {
          const idVal = it.id as any;
          if (idVal === null || idVal === undefined) return false;
          const s = String(idVal).trim();
          if (s === "") return false; // empty string => create
          return !Number.isNaN(Number(s));
        });
        const toCreate = items.filter((it) => {
          const idVal = it.id as any;
          if (idVal === null || idVal === undefined) return true;
          const s = String(idVal).trim();
          if (s === "") return true; // empty string => create
          return Number.isNaN(Number(s));
        });

        const keepIds: number[] = [];

        // Update existing items
        for (const it of toUpdate) {
          const itemId = Number(it.id);
          keepIds.push(itemId);
          const qty = it.qty ?? null;
          const rate = it.rate ?? null;
          const amount =
            it.amount ??
            (qty != null && rate != null
              ? (Number(qty) * Number(rate)).toFixed(2)
              : null);
          const orderedQty = it.orderedQty ?? 0;
          const orderedValue = it.orderedValue ?? null;
          const remainingQty = it.remainingQty ?? null;
          const remainingValue = it.remainingValue ?? null;
          await tx.boqItem.update({
            where: { id: itemId },
            data: {
              boqId: id,
              activityId: it.activityId ?? null,
              clientSrNo: it.clientSrNo ?? null,
              item: it.item ?? null,
              unitId: it.unitId ?? null,
              qty: qty as any,
              rate: rate as any,
              amount: amount as any,
              orderedQty: orderedQty as any,
              orderedValue: orderedValue as any,
              remainingQty: remainingQty as any,
              remainingValue: remainingValue as any,
              isGroup: Boolean(it.isGroup) || false,
            },
          });
        }

        // Create new items
        for (const it of toCreate) {
          const qty = it.qty ?? null;
          const rate = it.rate ?? null;
          const amount =
            it.amount ??
            (qty != null && rate != null
              ? (Number(qty) * Number(rate)).toFixed(2)
              : null);
          const orderedQty = it.orderedQty ?? 0;
          const orderedValue = it.orderedValue ?? null;
          const remainingQty = it.remainingQty ?? null;
          const remainingValue = it.remainingValue ?? null;
          await tx.boqItem.create({
            data: {
              boqId: id,
              activityId: it.activityId ?? null,
              clientSrNo: it.clientSrNo ?? null,
              item: it.item ?? null,
              unitId: it.unitId ?? null,
              qty: qty as any,
              rate: rate as any,
              amount: amount as any,
              orderedQty: orderedQty as any,
              orderedValue: orderedValue as any,
              remainingQty: remainingQty as any,
              remainingValue: remainingValue as any,
              isGroup: Boolean(it.isGroup) || false,
            },
          });
        }

        // Delete items not kept (only among previously existing ones)
        if (existingIds.size) {
          const existingIdsArr = Array.from(existingIds);
          await tx.boqItem.deleteMany({
            where: {
              boqId: id,
              id: {
                in: existingIdsArr,
                notIn: keepIds.length ? keepIds : [0],
              },
            },
          });
        }
      }
      return updated;
    });
    return Success(result);
  } catch (e: any) {
    if (e?.code === "P2025") return Error("BOQ not found", 404);
    const code = e?.code ? ` (${e.code})` : "";
    const msg = typeof e?.message === "string" && e.message ? e.message : "Failed to update BOQ";
    return Error(`${msg}${code}`);
  }
}
