import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";
import { z } from "zod";

const createSchema = z.object({
  siteId: z.coerce.number().int().positive(),
  boqId: z.coerce.number().int().positive(),
  month: z.string().min(1).max(50),
  week: z.string().min(1).max(50),
  fromTargetDate: z
    .string()
    .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid fromTargetDate" }),
  toTargetDate: z
    .string()
    .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid toTargetDate" }),
  details: z
    .array(
      z.object({
        boqItemId: z.coerce.number().int().positive(),
        totalMonthQty: z.coerce.number().nonnegative().optional().default(0),
        dailyTargetQty: z.coerce.number().nonnegative().optional().nullable(),
      })
    )
    .optional()
    .default([]),
});

const updateSchema = createSchema
  .partial()
  .extend({
    id: z.coerce.number().int().positive(),
    recalculateMonth: z.coerce.boolean().optional(),
    details: z
      .array(
        z.object({
          boqItemId: z.coerce.number().int().positive(),
          totalMonthQty: z.coerce.number().nonnegative().optional(),
          dailyTargetQty: z.coerce.number().nonnegative().optional().nullable(),
        })
      )
      .optional(),
  })
  .refine(
    (d) => {
      if (d.fromTargetDate && d.toTargetDate) {
        return new Date(d.fromTargetDate) <= new Date(d.toTargetDate);
      }
      return true;
    },
    { message: "fromTargetDate must be before or equal to toTargetDate", path: ["toTargetDate"] }
  );

// GET /api/boq-targets - List BOQ targets with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const siteIdParam = (searchParams.get("siteId") || "").trim();
  const monthParam = (searchParams.get("month") || "").trim();
  const weekParam = (searchParams.get("week") || "").trim();
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type BoqTargetWhere = {
    OR?: {
      month?: { contains: string };
      week?: { contains: string };
      site?: { site: { contains: string } };
      boq?: { boqNo: { contains: string } };
    }[];
    siteId?: number | { in: number[] };
    month?: string;
    week?: string;
  };
  const where: BoqTargetWhere = {};
  if (search) {
    where.OR = [
      { month: { contains: search } },
      { week: { contains: search } },
      { site: { site: { contains: search } } },
      { boq: { boqNo: { contains: search } } },
    ];
  }

  const siteIdFilter = siteIdParam ? Number(siteIdParam) : undefined;
  if (siteIdParam && (siteIdFilter === undefined || !Number.isFinite(siteIdFilter) || siteIdFilter <= 0)) {
    return Error("Invalid siteId", 400);
  }
  if (monthParam) where.month = monthParam;
  if (weekParam) where.week = weekParam;

  const sortableFields = new Set(["month", "week", "fromTargetDate", "toTargetDate", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { createdAt: "desc" };

  // Site-based visibility: only ADMIN can see all; others limited to assigned sites
  if ((auth as any).user?.role !== ROLES.ADMIN) {
    const employee = await prisma.employee.findFirst({
      where: { userId: (auth as any).user?.id },
      select: { siteEmployees: { select: { siteId: true } } },
    });
    const assignedSiteIds: number[] = (employee?.siteEmployees || [])
      .map((s) => s.siteId)
      .filter((v): v is number => typeof v === "number");

    if (typeof siteIdFilter === "number") {
      // If user tries to filter to a site they don't have access to, return empty list.
      (where as any).siteId = assignedSiteIds.includes(siteIdFilter) ? siteIdFilter : { in: [-1] };
    } else {
      (where as any).siteId = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
    }
  } else {
    if (typeof siteIdFilter === "number") where.siteId = siteIdFilter;
  }

  const result = await paginate({
    model: prisma.boqTarget as any,
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
      month: true,
      week: true,
      fromTargetDate: true,
      toTargetDate: true,
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

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const fromDate = new Date(parsed.fromTargetDate);
    const toDate = new Date(parsed.toTargetDate);
    if (fromDate > toDate) {
      return Error("fromTargetDate must be before or equal to toTargetDate", 400);
    }

    const boq = await prisma.boq.findUnique({
      where: { id: parsed.boqId },
      select: { id: true, siteId: true },
    });
    if (!boq) return Error("BOQ not found", 404);
    if (boq.siteId !== parsed.siteId) {
      return Error("Selected BOQ does not belong to selected site", 400);
    }

    const monthVal = parsed.month.trim();
    const weekVal = parsed.week.trim();
    const existingCombo = await prisma.boqTarget.findFirst({
      where: {
        siteId: parsed.siteId,
        boqId: parsed.boqId,
        month: monthVal,
        week: weekVal,
      },
      select: { id: true },
    });
    if (existingCombo) {
      return Error("BOQ Target for selected month and week already exists", 400);
    }

    const itemIds = Array.from(
      new Set((parsed.details || []).map((d) => Number(d.boqItemId)))
    ).filter((v) => Number.isFinite(v) && v > 0);

    if (itemIds.length) {
      const boqItems = await prisma.boqItem.findMany({
        where: { id: { in: itemIds }, boqId: parsed.boqId },
        select: { id: true },
      });
      if (boqItems.length !== itemIds.length) {
        return Error("One or more BOQ items are invalid for selected BOQ", 400);
      }
    }

    const detailsCreate = (parsed.details || [])
      .map((d) => ({
        BoqItemId: Number(d.boqItemId),
        totalMonthQty: Number((d as any).totalMonthQty ?? 0) as any,
        dailyTargetQty:
          d.dailyTargetQty === null || d.dailyTargetQty === undefined
            ? null
            : (Number(d.dailyTargetQty) as any),
      }))
      .filter((d) => d.dailyTargetQty !== null);

    const created = await prisma.boqTarget.create({
      data: {
        siteId: parsed.siteId,
        boqId: parsed.boqId,
        month: monthVal,
        week: weekVal,
        fromTargetDate: fromDate,
        toTargetDate: toDate,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        ...(detailsCreate.length
          ? { boqTargetDetails: { create: detailsCreate as any } }
          : {}),
      } as any,
      select: {
        id: true,
        siteId: true,
        boqId: true,
        month: true,
        week: true,
        fromTargetDate: true,
        toTargetDate: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    return Success(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return Error(err.errors as any, 400);
    console.error("Error creating BOQ target:", err);
    return Error("Failed to create BOQ target", 500);
  }
}

// PATCH /api/boq-targets - Update BOQ target
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const existing = await prisma.boqTarget.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        siteId: true,
        boqId: true,
        month: true,
        week: true,
        fromTargetDate: true,
        toTargetDate: true,
      },
    });
    if (!existing) return Error("BOQ Target not found", 404);

    const nextSiteId = parsed.siteId ?? existing.siteId;
    const nextBoqId = parsed.boqId ?? existing.boqId;
    const nextFrom = parsed.fromTargetDate ? new Date(parsed.fromTargetDate) : existing.fromTargetDate;
    const nextTo = parsed.toTargetDate ? new Date(parsed.toTargetDate) : existing.toTargetDate;
    if (nextFrom > nextTo) return Error("fromTargetDate must be before or equal to toTargetDate", 400);

    const nextMonth = parsed.month !== undefined ? parsed.month.trim() : existing.month;
    const nextWeek = parsed.week !== undefined ? parsed.week.trim() : existing.week;
    const existingCombo = await prisma.boqTarget.findFirst({
      where: {
        siteId: nextSiteId,
        boqId: nextBoqId,
        month: nextMonth,
        week: nextWeek,
        id: { not: parsed.id },
      },
      select: { id: true },
    });
    if (existingCombo) {
      return Error("BOQ Target for selected month and week already exists", 400);
    }

    const boq = await prisma.boq.findUnique({
      where: { id: nextBoqId },
      select: { id: true, siteId: true },
    });
    if (!boq) return Error("BOQ not found", 404);
    if (boq.siteId !== nextSiteId) {
      return Error("Selected BOQ does not belong to selected site", 400);
    }

    if (Array.isArray(parsed.details)) {
      const itemIds = Array.from(
        new Set((parsed.details || []).map((d) => Number(d.boqItemId)))
      ).filter((v) => Number.isFinite(v) && v > 0);

      if (itemIds.length) {
        const boqItems = await prisma.boqItem.findMany({
          where: { id: { in: itemIds }, boqId: nextBoqId },
          select: { id: true },
        });
        if (boqItems.length !== itemIds.length) {
          return Error("One or more BOQ items are invalid for selected BOQ", 400);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.boqTarget.update({
        where: { id: parsed.id },
        data: {
          ...(parsed.siteId !== undefined ? { siteId: nextSiteId } : {}),
          ...(parsed.boqId !== undefined ? { boqId: nextBoqId } : {}),
          ...(parsed.month !== undefined ? { month: nextMonth } : {}),
          ...(parsed.week !== undefined ? { week: nextWeek } : {}),
          ...(parsed.fromTargetDate !== undefined ? { fromTargetDate: nextFrom } : {}),
          ...(parsed.toTargetDate !== undefined ? { toTargetDate: nextTo } : {}),
          updatedById: auth.user.id,
        } as any,
        select: { id: true },
      });

      const shouldRecalc = Boolean(parsed.recalculateMonth);
      if (Array.isArray(parsed.details)) {
        // Update this week's quantities first
        const existingDetails = await tx.boqTargetDetail.findMany({
          where: { boqTargetId: parsed.id },
          select: { id: true, BoqItemId: true },
        });
        const byItemId = new Map<number, number>();
        existingDetails.forEach((d) => byItemId.set(Number(d.BoqItemId), Number(d.id)));

        for (const d of parsed.details || []) {
          const boqItemId = Number(d.boqItemId);
          const dailyTargetQty =
            d.dailyTargetQty === null || d.dailyTargetQty === undefined
              ? null
              : (Number(d.dailyTargetQty) as any);
          const totalMonthQty = (d as any).totalMonthQty;

          const existingDetailId = byItemId.get(boqItemId);
          if (existingDetailId) {
            await tx.boqTargetDetail.update({
              where: { id: existingDetailId },
              data: {
                dailyTargetQty,
                ...(totalMonthQty !== undefined ? { totalMonthQty: Number(totalMonthQty) as any } : {}),
              } as any,
              select: { id: true },
            });
          } else {
            // Only create if value provided; otherwise keep DB clean.
            if (dailyTargetQty !== null) {
              await tx.boqTargetDetail.create({
                data: {
                  boqTargetId: parsed.id,
                  BoqItemId: boqItemId,
                  totalMonthQty: Number(totalMonthQty ?? 0) as any,
                  dailyTargetQty,
                } as any,
                select: { id: true },
              });
            }
          }
        }

        // Recalculate monthly total (sum of all week quantities) and persist to all 4 week records
        if (shouldRecalc) {
          const itemIds = Array.from(new Set((parsed.details || []).map((d) => Number(d.boqItemId)))).filter(
            (v) => Number.isFinite(v) && v > 0
          );

          const monthTargets = await tx.boqTarget.findMany({
            where: { siteId: nextSiteId, boqId: nextBoqId, month: nextMonth },
            select: { id: true },
          });
          const monthTargetIds = monthTargets.map((t) => Number(t.id)).filter((v) => Number.isFinite(v) && v > 0);
          if (!monthTargetIds.length) {
            throw new globalThis.Error("No BOQ targets found for selected month");
          }

          const grouped = await tx.boqTargetDetail.groupBy({
            by: ["BoqItemId"],
            where: {
              BoqItemId: { in: itemIds },
              boqTargetId: { in: monthTargetIds },
            },
            _sum: { dailyTargetQty: true },
          });

          const sumByItemId = new Map<number, number>();
          grouped.forEach((g) => {
            const id = Number(g.BoqItemId);
            const sum = g._sum?.dailyTargetQty == null ? 0 : Number(g._sum.dailyTargetQty as any);
            sumByItemId.set(id, sum);
          });

          for (const itemId of itemIds) {
            const total = sumByItemId.get(itemId) ?? 0;
            await tx.boqTargetDetail.updateMany({
              where: {
                BoqItemId: itemId,
                boqTargetId: { in: monthTargetIds },
              },
              data: { totalMonthQty: total as any },
            });
          }
        }
      }

      const updated = await tx.boqTarget.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          siteId: true,
          boqId: true,
          month: true,
          week: true,
          fromTargetDate: true,
          toTargetDate: true,
          createdAt: true,
          updatedAt: true,
        } as any,
      });
      return updated;
    });

    return Success(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) return Error(err.errors as any, 400);
    console.error("Error updating BOQ target:", err);
    return Error("Failed to update BOQ target", 500);
  }
}
