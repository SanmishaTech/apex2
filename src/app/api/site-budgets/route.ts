import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";
import { z } from "zod";

function toUtcDateOnly(dateStr: string): Date {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw new globalThis.Error("Invalid date");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const budgetItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  budgetQty: z.coerce.number().nonnegative(),
  budgetRate: z.coerce.number().nonnegative(),
  purchaseRate: z.coerce.number().nonnegative(),
  budgetValue: z.coerce.number().nonnegative().optional(),
});

const detailSchema = z.object({
  boqItemId: z.coerce.number().int().positive(),
  items: z.array(budgetItemSchema).optional().default([]),
});

type QtyKey = `${number}::${number}`; // boqItemId::itemId

type OverallBudgetViolation = {
  boqItemId: number;
  itemId: number;
  field: "budgetQty" | "budgetRate" | "budgetValue";
  existingValue?: number;
  incomingValue?: number;
  usedValue?: number;
  overallValue?: number;
};

async function validateAgainstOverallBudget({
  overallSiteBudgetId,
  incomingDetails,
  excludeSiteBudgetId,
}: {
  overallSiteBudgetId: number;
  incomingDetails: Array<{
    boqItemId: number;
    items: Array<{ itemId: number; budgetQty: number; budgetRate: number; budgetValue: number }>;
  }>;
  excludeSiteBudgetId?: number;
}) {
  const overall = await (prisma as any).overallSiteBudget.findUnique({
    where: { id: overallSiteBudgetId },
    select: {
      id: true,
      overallSiteBudgetDetails: {
        select: {
          BoqItemId: true,
          boqItem: { select: { id: true, item: true, activityId: true } },
          overallSiteBudgetItems: {
            select: {
              itemId: true,
              budgetQty: true,
              budgetRate: true,
              budgetValue: true,
              item: { select: { id: true, item: true, itemCode: true } },
            },
          },
        },
      },
    },
  });
  if (!overall) return { ok: false as const, error: "Overall Site Budget not found" };

  const overallQtyByKey = new Map<QtyKey, number>();
  const overallRateByKey = new Map<QtyKey, number>();
  const overallValueByKey = new Map<QtyKey, number>();
  const labelByKey = new Map<QtyKey, { boqItemLabel: string; itemLabel: string }>();
  for (const d of overall.overallSiteBudgetDetails || []) {
    const boqItemId = Number(d.BoqItemId);
    const boqItemLabel = `${d?.boqItem?.activityId || "BOQ"}-${boqItemId}`;
    for (const it of d.overallSiteBudgetItems || []) {
      const itemId = Number(it.itemId);
      const key: QtyKey = `${boqItemId}::${itemId}`;
      overallQtyByKey.set(key, Number(it?.budgetQty ?? 0));
      overallRateByKey.set(key, Number((it as any)?.budgetRate ?? 0));
      overallValueByKey.set(key, Number((it as any)?.budgetValue ?? 0));
      labelByKey.set(key, {
        boqItemLabel,
        itemLabel: `${it?.item?.itemCode || "ITEM"}-${itemId} ${it?.item?.item || ""}`.trim(),
      });
    }
  }

  const existingRows = await (prisma as any).siteBudgetItem.findMany({
    where: {
      siteBudgetDetail: {
        siteBudget: {
          overallSiteBudgetId,
          ...(excludeSiteBudgetId ? { id: { not: excludeSiteBudgetId } } : {}),
        },
      },
    },
    select: {
      itemId: true,
      budgetQty: true,
      budgetRate: true,
      budgetValue: true,
      siteBudgetDetail: { select: { BoqItemId: true } },
    },
  });

  const existingQtyByKey = new Map<QtyKey, number>();
  const existingValueByKey = new Map<QtyKey, number>();
  for (const r of existingRows || []) {
    const boqItemId = Number(r?.siteBudgetDetail?.BoqItemId);
    const itemId = Number(r?.itemId);
    const key: QtyKey = `${boqItemId}::${itemId}`;
    const q = Number(r?.budgetQty ?? 0);
    existingQtyByKey.set(key, Number((existingQtyByKey.get(key) || 0) + (Number.isFinite(q) ? q : 0)));

    const v = Number((r as any)?.budgetValue ?? 0);
    existingValueByKey.set(
      key,
      Number((existingValueByKey.get(key) || 0) + (Number.isFinite(v) ? v : 0))
    );
  }

  const incomingQtyByKey = new Map<QtyKey, number>();
  const incomingValueByKey = new Map<QtyKey, number>();
  const incomingMaxRateByKey = new Map<QtyKey, number>();
  for (const d of incomingDetails || []) {
    const boqItemId = Number(d.boqItemId);
    for (const it of d.items || []) {
      const itemId = Number(it.itemId);
      const q = Number(it.budgetQty ?? 0);
      if (!(Number.isFinite(itemId) && itemId > 0)) continue;
      if (!(Number.isFinite(q) && q >= 0)) continue;
      const key: QtyKey = `${boqItemId}::${itemId}`;
      incomingQtyByKey.set(key, Number((incomingQtyByKey.get(key) || 0) + q));

      const rate = Number((it as any)?.budgetRate ?? 0);
      if (Number.isFinite(rate) && rate >= 0) {
        const prev = Number(incomingMaxRateByKey.get(key) || 0);
        incomingMaxRateByKey.set(key, Math.max(prev, rate));
      }

      const value = Number((it as any)?.budgetValue ?? 0);
      if (Number.isFinite(value)) {
        incomingValueByKey.set(key, Number((incomingValueByKey.get(key) || 0) + value));
      }
    }
  }

  const violations: OverallBudgetViolation[] = [];

  // Qty + Value are cumulative (existing + incoming)
  for (const [key, incQty] of incomingQtyByKey.entries()) {
    const overallQty = Number(overallQtyByKey.get(key) || 0);
    const usedQty = Number((existingQtyByKey.get(key) || 0) + incQty);
    if (usedQty > overallQty) {
      const [boqItemIdStr, itemIdStr] = String(key).split("::");
      violations.push({
        boqItemId: Number(boqItemIdStr) || 0,
        itemId: Number(itemIdStr) || 0,
        field: "budgetQty",
        usedValue: usedQty,
        overallValue: overallQty,
      });
    }
  }

  for (const [key, incValue] of incomingValueByKey.entries()) {
    const overallValue = Number(overallValueByKey.get(key) || 0);
    const usedValue = Number((existingValueByKey.get(key) || 0) + incValue);
    if (usedValue > overallValue) {
      const [boqItemIdStr, itemIdStr] = String(key).split("::");
      violations.push({
        boqItemId: Number(boqItemIdStr) || 0,
        itemId: Number(itemIdStr) || 0,
        field: "budgetValue",
        usedValue,
        overallValue,
      });
    }
  }

  // Rate is per-current-row (max incoming rate for key must not exceed overall rate)
  for (const [key, maxRate] of incomingMaxRateByKey.entries()) {
    const overallRate = Number(overallRateByKey.get(key) || 0);
    if (Number(maxRate) > Number(overallRate)) {
      const [boqItemIdStr, itemIdStr] = String(key).split("::");
      violations.push({
        boqItemId: Number(boqItemIdStr) || 0,
        itemId: Number(itemIdStr) || 0,
        field: "budgetRate",
        incomingValue: Number(maxRate),
        overallValue: overallRate,
      });
    }
  }

  if (violations.length) {
    const lines = violations
      .slice(0, 20)
      .map((v) => {
        const key: QtyKey = `${v.boqItemId}::${v.itemId}`;
        const labels = labelByKey.get(key);
        const left = `${labels?.boqItemLabel || v.boqItemId} | ${labels?.itemLabel || v.itemId}`;
        if (v.field === "budgetRate") {
          return `${left}: Rate ${Number(v.incomingValue || 0)} > ${Number(v.overallValue || 0)}`;
        }
        return `${left}: ${Number(v.usedValue || 0)} > ${Number(v.overallValue || 0)}`;
      });
    const msg =
      "Overall budget validation failed:\n" +
      lines.join("\n") +
      (violations.length > 20 ? `\n...and ${violations.length - 20} more` : "");
    return { ok: false as const, error: msg, violations };
  }

  return { ok: true as const };
}

const createSchema = z
  .object({
    siteId: z.coerce.number().int().positive(),
    boqId: z.coerce.number().int().positive(),
    overallSiteBudgetId: z.coerce.number().int().positive(),
    month: z.string().min(1).max(50),
    week: z.string().min(1).max(50),
    fromDate: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid fromDate" }),
    toDate: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid toDate" }),
    details: z.array(detailSchema).optional().default([]),
    applyOverallBudgetValidation: z.coerce.boolean().optional().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.fromDate && d.toDate && new Date(d.fromDate) > new Date(d.toDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fromDate must be before or equal to toDate",
        path: ["toDate"],
      });
    }
  });

const updateSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    siteId: z.coerce.number().int().positive().optional(),
    boqId: z.coerce.number().int().positive().optional(),
    overallSiteBudgetId: z.coerce.number().int().positive().optional(),
    month: z.string().min(1).max(50).optional(),
    week: z.string().min(1).max(50).optional(),
    fromDate: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid fromDate" })
      .optional(),
    toDate: z
      .string()
      .refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid toDate" })
      .optional(),
    details: z.array(detailSchema).optional(),
    applyOverallBudgetValidation: z.coerce.boolean().optional().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.fromDate && d.toDate && new Date(d.fromDate) > new Date(d.toDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fromDate must be before or equal to toDate",
        path: ["toDate"],
      });
    }
  });

// GET /api/site-budgets - List Site Budgets with pagination and search
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
  const siteIdParam = (searchParams.get("siteId") || "").trim();
  const monthParam = (searchParams.get("month") || "").trim();
  const weekParam = (searchParams.get("week") || "").trim();
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  type SiteBudgetWhere = {
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

  const where: SiteBudgetWhere = {};
  if (search) {
    where.OR = [
      { month: { contains: search } },
      { week: { contains: search } },
      { site: { site: { contains: search } } },
      { boq: { boqNo: { contains: search } } },
    ];
  }

  const siteIdFilter = siteIdParam ? Number(siteIdParam) : undefined;
  if (
    siteIdParam &&
    (siteIdFilter === undefined || !Number.isFinite(siteIdFilter) || siteIdFilter <= 0)
  ) {
    return ApiError("Invalid siteId", 400);
  }
  if (monthParam) where.month = monthParam;
  if (weekParam) where.week = weekParam;

  const sortableFields = new Set(["month", "week", "fromDate", "toDate", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

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
      (where as any).siteId = assignedSiteIds.includes(siteIdFilter)
        ? siteIdFilter
        : { in: [-1] };
    } else {
      (where as any).siteId = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
    }
  } else {
    if (typeof siteIdFilter === "number") where.siteId = siteIdFilter;
  }

  const result = await paginate({
    model: (prisma as any).siteBudget,
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
      fromDate: true,
      toDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/site-budgets - Create new Site Budget
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const fromDate = toUtcDateOnly(parsed.fromDate);
    const toDate = toUtcDateOnly(parsed.toDate);
    if (fromDate > toDate) {
      return ApiError("fromDate must be before or equal to toDate", 400);
    }

    const boq = await prisma.boq.findUnique({
      where: { id: parsed.boqId },
      select: { id: true, siteId: true },
    });
    if (!boq) return ApiError("BOQ not found", 404);
    if (boq.siteId !== parsed.siteId) {
      return ApiError("Selected BOQ does not belong to selected site", 400);
    }

    const overall = await (prisma as any).overallSiteBudget.findUnique({
      where: { id: parsed.overallSiteBudgetId },
      select: { id: true, siteId: true, boqId: true },
    });
    if (!overall) return ApiError("Overall Site Budget not found", 404);
    if (overall.siteId !== parsed.siteId || overall.boqId !== parsed.boqId) {
      return ApiError("Selected Overall Site Budget does not match selected site/BOQ", 400);
    }

    const monthVal = parsed.month.trim();
    const weekVal = parsed.week.trim();
    const existingCombo = await (prisma as any).siteBudget.findFirst({
      where: {
        siteId: parsed.siteId,
        boqId: parsed.boqId,
        month: monthVal,
        week: weekVal,
      },
      select: { id: true },
    });
    if (existingCombo) {
      return ApiError("Site Budget for selected month and week already exists", 400);
    }

    const boqItemIds = Array.from(
      new Set<number>((parsed.details || []).map((d) => Number(d.boqItemId)))
    ).filter((v): v is number => Number.isFinite(v) && v > 0);

    if (boqItemIds.length) {
      const boqItems = await prisma.boqItem.findMany({
        where: { id: { in: boqItemIds }, boqId: parsed.boqId },
        select: { id: true },
      });
      if (boqItems.length !== boqItemIds.length) {
        return ApiError("One or more BOQ items are invalid for selected BOQ", 400);
      }
    }

    if (parsed.applyOverallBudgetValidation) {
      const v = await validateAgainstOverallBudget({
        overallSiteBudgetId: parsed.overallSiteBudgetId,
        incomingDetails: (parsed.details || []).map((d) => ({
          boqItemId: Number(d.boqItemId),
          items: (d.items || []).map((it) => ({
            itemId: Number(it.itemId),
            budgetQty: Number(it.budgetQty || 0),
            budgetRate: Number(it.budgetRate || 0),
            budgetValue: Number((it as any).budgetValue ?? 0),
          })),
        })),
      });
      if (!v.ok) {
        return NextResponse.json(
          {
            message: v.error,
            code: "OVERALL_BUDGET_VALIDATION",
            violations: (v as any).violations || [],
          },
          { status: 400 }
        );
      }
    }

    const detailsCreate = (parsed.details || [])
      .map((d) => {
        const itemsCreate = (d.items || [])
          .map((it) => {
            const budgetQty = Number(it.budgetQty || 0);
            const budgetRate = Number(it.budgetRate || 0);
            const purchaseRate = Number(it.purchaseRate || 0);
            const budgetValue = Number(
              it.budgetValue !== undefined && it.budgetValue !== null
                ? it.budgetValue
                : budgetQty * budgetRate
            );
            return {
              itemId: Number(it.itemId),
              budgetQty: budgetQty as any,
              budgetRate: budgetRate as any,
              purchaseRate: purchaseRate as any,
              budgetValue: budgetValue as any,
            };
          })
          .filter((it) => Number.isFinite(Number(it.itemId)) && Number(it.itemId) > 0);

        if (!itemsCreate.length) return null;
        return {
          BoqItemId: Number(d.boqItemId),
          siteBudgetItems: { create: itemsCreate as any },
        };
      })
      .filter(Boolean);

    const created = await (prisma as any).$transaction(async (tx: any) => {
      const createdBudget = await tx.siteBudget.create({
        data: {
          siteId: parsed.siteId,
          boqId: parsed.boqId,
          overallSiteBudgetId: parsed.overallSiteBudgetId,
          month: monthVal,
          week: weekVal,
          fromDate,
          toDate,
          createdById: (auth as any).user.id,
          updatedById: (auth as any).user.id,
          ...(detailsCreate.length
            ? { siteBudgetDetails: { create: detailsCreate as any } }
            : {}),
        },
        select: {
          id: true,
          siteId: true,
          boqId: true,
          month: true,
          week: true,
          fromDate: true,
          toDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return createdBudget;
    });

    return Success(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return ApiError(err.errors as any, 400);
    console.error("Create site budget error:", err);
    return ApiError("Failed to create site budget", 500);
  }
}

// PATCH /api/site-budgets - Update Site Budget
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const existing = await (prisma as any).siteBudget.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        siteId: true,
        boqId: true,
        overallSiteBudgetId: true,
        month: true,
        week: true,
        fromDate: true,
        toDate: true,
      },
    });
    if (!existing) return ApiError("Site Budget not found", 404);

    const nextSiteId = parsed.siteId ?? existing.siteId;
    const nextBoqId = parsed.boqId ?? existing.boqId;
    const nextOverallSiteBudgetId =
      parsed.overallSiteBudgetId ?? existing.overallSiteBudgetId;
    const nextFrom = parsed.fromDate ? toUtcDateOnly(parsed.fromDate) : existing.fromDate;
    const nextTo = parsed.toDate ? toUtcDateOnly(parsed.toDate) : existing.toDate;
    if (nextFrom > nextTo) return ApiError("fromDate must be before or equal to toDate", 400);

    const nextMonth = parsed.month !== undefined ? parsed.month.trim() : existing.month;
    const nextWeek = parsed.week !== undefined ? parsed.week.trim() : existing.week;

    const existingCombo = await (prisma as any).siteBudget.findFirst({
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
      return ApiError("Site Budget for selected month and week already exists", 400);
    }

    const boq = await prisma.boq.findUnique({
      where: { id: nextBoqId },
      select: { id: true, siteId: true },
    });
    if (!boq) return ApiError("BOQ not found", 404);
    if (boq.siteId !== nextSiteId) {
      return ApiError("Selected BOQ does not belong to selected site", 400);
    }

    const overall = await (prisma as any).overallSiteBudget.findUnique({
      where: { id: nextOverallSiteBudgetId },
      select: { id: true, siteId: true, boqId: true },
    });
    if (!overall) return ApiError("Overall Site Budget not found", 404);
    if (overall.siteId !== nextSiteId || overall.boqId !== nextBoqId) {
      return ApiError("Selected Overall Site Budget does not match selected site/BOQ", 400);
    }

    if (parsed.applyOverallBudgetValidation && Array.isArray(parsed.details)) {
      const v = await validateAgainstOverallBudget({
        overallSiteBudgetId: nextOverallSiteBudgetId,
        incomingDetails: (parsed.details || []).map((d) => ({
          boqItemId: Number(d.boqItemId),
          items: (d.items || []).map((it) => ({
            itemId: Number(it.itemId),
            budgetQty: Number(it.budgetQty || 0),
            budgetRate: Number(it.budgetRate || 0),
            budgetValue: Number((it as any).budgetValue ?? 0),
          })),
        })),
        excludeSiteBudgetId: parsed.id,
      });
      if (!v.ok) {
        return NextResponse.json(
          {
            message: v.error,
            code: "OVERALL_BUDGET_VALIDATION",
            violations: (v as any).violations || [],
          },
          { status: 400 }
        );
      }
    }

    if (Array.isArray(parsed.details)) {
      const boqItemIds = Array.from(
        new Set<number>((parsed.details || []).map((d) => Number(d.boqItemId)))
      ).filter((v): v is number => Number.isFinite(v) && v > 0);
      if (boqItemIds.length) {
        const boqItems = await prisma.boqItem.findMany({
          where: { id: { in: boqItemIds }, boqId: nextBoqId },
          select: { id: true },
        });
        if (boqItems.length !== boqItemIds.length) {
          return ApiError("One or more BOQ items are invalid for selected BOQ", 400);
        }
      }
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      await tx.siteBudget.update({
        where: { id: parsed.id },
        data: {
          ...(parsed.siteId !== undefined ? { siteId: nextSiteId } : {}),
          ...(parsed.boqId !== undefined ? { boqId: nextBoqId } : {}),
          ...(parsed.overallSiteBudgetId !== undefined
            ? { overallSiteBudgetId: nextOverallSiteBudgetId }
            : {}),
          ...(parsed.month !== undefined ? { month: nextMonth } : {}),
          ...(parsed.week !== undefined ? { week: nextWeek } : {}),
          ...(parsed.fromDate !== undefined ? { fromDate: nextFrom } : {}),
          ...(parsed.toDate !== undefined ? { toDate: nextTo } : {}),
          updatedById: (auth as any).user.id,
        },
        select: { id: true },
      });

      if (Array.isArray(parsed.details)) {
        const existingDetails = await tx.siteBudgetDetail.findMany({
          where: { SiteBudgetId: parsed.id },
          select: {
            id: true,
            BoqItemId: true,
            siteBudgetItems: { select: { id: true, itemId: true } },
          },
        });

        const detailByBoqItemId = new Map<number, any>();
        existingDetails.forEach((d: any) => detailByBoqItemId.set(Number(d.BoqItemId), d));

        const incomingBoqItemIds = new Set<number>();

        for (const d of parsed.details || []) {
          const boqItemId = Number(d.boqItemId);
          incomingBoqItemIds.add(boqItemId);

          const incomingItems = (d.items || [])
            .map((it) => ({
              itemId: Number(it.itemId),
              budgetQty: Number(it.budgetQty || 0),
              budgetRate: Number(it.budgetRate || 0),
              purchaseRate: Number(it.purchaseRate || 0),
              budgetValue: Number(
                (it as any).budgetValue !== undefined && (it as any).budgetValue !== null
                  ? (it as any).budgetValue
                  : Number(it.budgetQty || 0) * Number(it.budgetRate || 0)
              ),
            }))
            .filter((it) => Number.isFinite(it.itemId) && it.itemId > 0);

          const existingDetail = detailByBoqItemId.get(boqItemId);

          if (!incomingItems.length) {
            if (existingDetail?.id) {
              await tx.siteBudgetItem.deleteMany({
                where: { SiteBudgetDetailId: existingDetail.id },
              });
              await tx.siteBudgetDetail.delete({ where: { id: existingDetail.id } });
            }
            continue;
          }

          let detailId = existingDetail?.id as number | undefined;
          if (!detailId) {
            const createdDetail = await tx.siteBudgetDetail.create({
              data: {
                SiteBudgetId: parsed.id,
                BoqItemId: boqItemId,
              },
              select: { id: true },
            });
            detailId = createdDetail.id;
          }

          const existingItemsByItemId = new Map<number, number>();
          (existingDetail?.siteBudgetItems || []).forEach((it: any) =>
            existingItemsByItemId.set(Number(it.itemId), Number(it.id))
          );

          const incomingItemIds = new Set<number>();
          for (const it of incomingItems) {
            incomingItemIds.add(it.itemId);
            const budgetValue = Number(it.budgetValue ?? it.budgetQty * it.budgetRate);
            const existingItemId = existingItemsByItemId.get(it.itemId);
            if (existingItemId) {
              await tx.siteBudgetItem.update({
                where: { id: existingItemId },
                data: {
                  budgetQty: it.budgetQty,
                  budgetRate: it.budgetRate,
                  purchaseRate: it.purchaseRate,
                  budgetValue,
                },
                select: { id: true },
              });
            } else {
              await tx.siteBudgetItem.create({
                data: {
                  SiteBudgetDetailId: detailId,
                  itemId: it.itemId,
                  budgetQty: it.budgetQty,
                  budgetRate: it.budgetRate,
                  purchaseRate: it.purchaseRate,
                  budgetValue,
                },
                select: { id: true },
              });
            }
          }

          // Remove items not in incoming
          const toDeleteIds: number[] = [];
          (existingDetail?.siteBudgetItems || []).forEach((it: any) => {
            const itemId = Number(it.itemId);
            if (!incomingItemIds.has(itemId)) toDeleteIds.push(Number(it.id));
          });
          if (toDeleteIds.length) {
            await tx.siteBudgetItem.deleteMany({ where: { id: { in: toDeleteIds } } });
          }
        }

        // Remove details not in incoming
        const extraDetails = existingDetails.filter(
          (d: any) => !incomingBoqItemIds.has(Number(d.BoqItemId))
        );
        for (const d of extraDetails) {
          await tx.siteBudgetItem.deleteMany({ where: { SiteBudgetDetailId: d.id } });
          await tx.siteBudgetDetail.delete({ where: { id: d.id } });
        }
      }

      return tx.siteBudget.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          siteId: true,
          boqId: true,
          month: true,
          week: true,
          fromDate: true,
          toDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return Success(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) return ApiError(err.errors as any, 400);
    console.error("Error updating site budget:", err);
    return ApiError("Failed to update site budget", 500);
  }
}
