// /app/api/daily-progresses/route.ts
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// Helper: sum doneQty by BOQ item id
function sumDoneQtyByBoqItem(
  details: { boqItemId?: number | null; doneQty?: any }[]
) {
  const map = new Map<number, number>();
  for (const d of details) {
    const id = Number(d.boqItemId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const qty = Number(d.doneQty || 0);
    map.set(id, (map.get(id) || 0) + qty);
  }
  return map;
}

// Apply qty deltas to BOQ items (increment ordered*, recompute remaining*)
async function applyBoqItemDeltas(
  tx: Prisma.TransactionClient,
  deltas: Map<number, number>
) {
  for (const [itemId, delta] of deltas) {
    if (!Number.isFinite(delta) || delta === 0) continue;
    const item = await tx.boqItem.findUnique({
      where: { id: itemId },
      select: { qty: true, rate: true, orderedQty: true },
    });
    if (!item) continue;

    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const currentOrdered = Number(item.orderedQty || 0);
    const nextOrdered = Math.max(0, currentOrdered + Number(delta));
    const remainingQty = qty - nextOrdered; // allow negative when over-ordered

    await tx.boqItem.update({
      where: { id: itemId },
      data: {
        orderedQty: nextOrdered as any,
        orderedValue: (nextOrdered * rate) as any,
        remainingQty: remainingQty as any,
        remainingValue: (remainingQty * rate) as any, // can be negative
      },
    });
  }
}

// GET /api/daily-progresses?search=&page=1&perPage=10&sort=progressDate&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  // Aggregate: doneQty sum for given siteId, boqId and boqItemId
  const metric = (searchParams.get("metric") || "").trim();
  const siteIdAgg = Number(searchParams.get("siteId"));
  const boqIdAgg = Number(searchParams.get("boqId"));
  const boqItemIdAgg = Number(searchParams.get("boqItemId"));
  if (
    metric === "doneQtySum" &&
    Number.isFinite(siteIdAgg) &&
    Number.isFinite(boqIdAgg) &&
    Number.isFinite(boqItemIdAgg)
  ) {
    try {
      const agg = await prisma.dailyProgressDetail.aggregate({
        _sum: { doneQty: true },
        where: {
          boqItemId: boqItemIdAgg,
          dailyProgress: {
            siteId: siteIdAgg,
            boqId: boqIdAgg,
          },
        },
      });
      const sumDoneQty = (agg._sum.doneQty as any) ?? 0;
      const item = await prisma.boqItem.findUnique({
        where: { id: boqItemIdAgg },
        select: { remainingQty: true },
      });
      const remainingQty = (item?.remainingQty as any) ?? 0;
      const balanceQty = Number(remainingQty) - Number(sumDoneQty);
      return Success({ sumDoneQty, remainingQty, balanceQty });
    } catch {
      return Error("Failed to aggregate done qty");
    }
  }
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(searchParams.get("perPage")) || 10)
  );
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "progressDate") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  type DPWhere = {
    OR?: (
      | { site: { site: { contains: string } } }
      | { boq: { boqNo: { contains: string } } }
    )[];
  };
  const where: DPWhere = {};

  // 🔍 Search by Site name OR BOQ number (case-insensitive)
  if (search) {
    where.OR = [
      { site: { site: { contains: search } } },
      { boq: { boqNo: { contains: search } } },
    ];
  }

  const sortableFields = new Set(["progressDate", "createdAt", "amount"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { progressDate: "desc" };

  // Site-based visibility: only ADMIN can see all; others limited to assigned sites
  if ((auth as any).user?.role !== ROLES.ADMIN) {
    const employee = await prisma.employee.findFirst({
      where: { userId: (auth as any).user?.id },
      select: { siteEmployees: { select: { siteId: true } } },
    });
    const assignedSiteIds: number[] = (employee?.siteEmployees || [])
      .map((s) => s.siteId)
      .filter((v): v is number => typeof v === "number");
    (where as any).siteId = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
  }

  const result = await paginate({
    model: prisma.dailyProgress as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      progressDate: true,
      amount: true,
      site: { select: { id: true, site: true } },
      boq: { select: { id: true, boqNo: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  return Success(result);
}

// POST /api/daily-progresses
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const userId = auth.user?.id; // ✅ automatically from logged-in user

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const b = (body as Record<string, any>) || {};

  const siteId = Number(b.siteId);
  const boqId = Number(b.boqId);
  const progressDate = b.progressDate ? new Date(String(b.progressDate)) : null;
  if (!siteId || !boqId || !progressDate)
    return Error("Missing required fields", 400);

  try {
    const details = Array.isArray(b.details)
      ? b.details.map((it: any) => ({
          boqItemId: it.boqItemId ?? null,
          clientSerialNo: it.clientSerialNo ?? null,
          activityId: it.activityId ?? null,
          particulars: it.particulars ?? null,
          doneQty: it.doneQty ?? 0,
          amount: it.amount ?? 0,
        }))
      : [];

    // 🔹 Calculate total doneQty
    const totalDoneQty = details.reduce(
      (sum, d) => sum + Number(d.doneQty || 0),
      0
    );

    const hindrances = Array.isArray(b.hindrances)
      ? b.hindrances.map((it: any) => ({
          from: it.from ? new Date(String(it.from)) : null,
          to: it.to ? new Date(String(it.to)) : null,
          hrs: it.hrs ?? null,
          location: it.location ?? null,
          reason: it.reason ?? null,
        }))
      : [];

    const created = await prisma.$transaction(async (tx) => {
      const dp = await tx.dailyProgress.create({
        data: {
          siteId,
          boqId,
          progressDate,
          amount: totalDoneQty, // 🔹 use total doneQty as dailyProgress.amount
          createdById: userId, // ✅ automatic
          updatedById: userId, // ✅ automatic
          ...(details.length
            ? { dailyProgressDetails: { create: details } }
            : {}),
          ...(hindrances.length
            ? { dailyProgressHindrances: { create: hindrances } }
            : {}),
        },
        select: { id: true, progressDate: true },
      });

      // 🔄 Increment ordered/remaining using deltas from submitted details
      const deltas = sumDoneQtyByBoqItem(details);
      await applyBoqItemDeltas(tx, deltas);

      return dp;
    });

    return Success(created, 201);
  } catch (e) {
    console.log(e);
    return Error("Failed to create Daily Progress");
  }
}

// PATCH /api/daily-progresses
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const userId = auth.user?.id; // ✅ current logged-in user

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }
  const b = (body as Record<string, any>) || {};
  const id = Number(b.id);
  if (!id) return Error("Daily Progress id required", 400);

  const data: Record<string, any> = {};
  if (b.siteId !== undefined)
    data.siteId = b.siteId == null ? null : Number(b.siteId);
  if (b.boqId !== undefined)
    data.boqId = b.boqId == null ? null : Number(b.boqId);
  if (b.progressDate !== undefined)
    data.progressDate = b.progressDate
      ? new Date(String(b.progressDate))
      : null;
  data.updatedById = userId; // ✅ automatic on update
  if (Array.isArray(b.details)) {
    data.amount = b.details.reduce((sum, d) => sum + Number(d.doneQty || 0), 0);
  } else if (b.amount !== undefined) {
    data.amount = b.amount ?? 0;
  }
  if (Object.keys(data).length === 0 && !b.details && !b.hindrances)
    return Error("Nothing to update", 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Capture impacted BOQ items and qty deltas
      const existingDetails = await tx.dailyProgressDetail.findMany({
        where: { dailyProgressId: id },
        select: { boqItemId: true, doneQty: true },
      });

      const updated = await tx.dailyProgress.update({
        where: { id },
        data,
        select: { id: true, progressDate: true },
      });

      if (Array.isArray(b.details)) {
        await tx.dailyProgressDetail.deleteMany({
          where: { dailyProgressId: id },
        });
        for (const it of b.details) {
          await tx.dailyProgressDetail.create({
            data: {
              dailyProgressId: id,
              boqItemId: it.boqItemId ?? null,
              clientSerialNo: it.clientSerialNo ?? null,
              activityId: it.activityId ?? null,
              particulars: it.particulars ?? null,
              doneQty: it.doneQty ?? 0,
              amount: it.amount ?? 0,
            },
          });
        }
      }

      if (Array.isArray(b.hindrances)) {
        await tx.dailyProgressHindrance.deleteMany({
          where: { dailyProgressId: id },
        });
        for (const it of b.hindrances) {
          await tx.dailyProgressHindrance.create({
            data: {
              dailyProgressId: id,
              from: it.from ? new Date(String(it.from)) : null,
              to: it.to ? new Date(String(it.to)) : null,
              hrs: it.hrs ?? null,
              location: it.location ?? null,
              reason: it.reason ?? null,
            },
          });
        }
      }

      // 🔄 Apply deltas: new - old to adjust ordered/remaining
      if (Array.isArray(b.details)) {
        const newDetails = b.details.map((d: any) => ({
          boqItemId: d.boqItemId,
          doneQty: d.doneQty,
        }));
        const prevMap = sumDoneQtyByBoqItem(existingDetails);
        const nextMap = sumDoneQtyByBoqItem(newDetails);
        const deltaMap = new Map<number, number>();

        for (const [itemId, qty] of prevMap.entries()) {
          deltaMap.set(itemId, (deltaMap.get(itemId) || 0) - qty);
        }
        for (const [itemId, qty] of nextMap.entries()) {
          deltaMap.set(itemId, (deltaMap.get(itemId) || 0) + qty);
        }

        await applyBoqItemDeltas(tx, deltaMap);
      }

      return updated;
    });
    return Success(result);
  } catch (e: any) {
    if (e?.code === "P2025") return Error("Daily Progress not found", 404);
    return Error("Failed to update Daily Progress");
  }
}
