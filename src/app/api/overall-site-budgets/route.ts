import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";
import { z } from "zod";

const budgetItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  budgetQty: z.coerce.number().nonnegative(),
  budgetRate: z.coerce.number().nonnegative(),
  purchaseRate: z.coerce.number().nonnegative(),
});

const detailSchema = z.object({
  boqItemId: z.coerce.number().int().positive(),
  items: z.array(budgetItemSchema).optional().default([]),
});

const createSchema = z.object({
  siteId: z.coerce.number().int().positive(),
  boqId: z.coerce.number().int().positive(),
  details: z.array(detailSchema).optional().default([]),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  siteId: z.coerce.number().int().positive().optional(),
  boqId: z.coerce.number().int().positive().optional(),
  details: z.array(detailSchema).optional(),
});

// GET /api/overall-site-budgets - List Overall Site Budgets with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const siteIdParam = (searchParams.get("siteId") || "").trim();
  const boqIdParam = (searchParams.get("boqId") || "").trim();
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type Where = {
    OR?: {
      site?: { site: { contains: string } };
      boq?: { boqNo: { contains: string } };
    }[];
    siteId?: number | { in: number[] };
    boqId?: number;
  };

  const where: Where = {};
  if (search) {
    where.OR = [
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

  const boqIdFilter = boqIdParam ? Number(boqIdParam) : undefined;
  if (boqIdParam && (boqIdFilter === undefined || !Number.isFinite(boqIdFilter) || boqIdFilter <= 0)) {
    return ApiError("Invalid boqId", 400);
  }

  if (typeof boqIdFilter === "number") where.boqId = boqIdFilter;

  const sortableFields = new Set(["createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

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
    model: (prisma as any).overallSiteBudget,
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
      isTechApprovalDone: true,
      isCommercialApprovalDone: true,
      isProjectApprovalDone: true,
      createdById: true,
      techApprovalById: true,
      commercialApprovalById: true,
      projectApprovalById: true,
      createdBy: { select: { id: true, name: true } },
      techApprovalBy: { select: { id: true, name: true } },
      commercialApprovalBy: { select: { id: true, name: true } },
      projectApprovalBy: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  return Success(result);
}

// POST /api/overall-site-budgets - Create new Overall Site Budget
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const boq = await prisma.boq.findUnique({
      where: { id: parsed.boqId },
      select: { id: true, siteId: true },
    });
    if (!boq) return ApiError("BOQ not found", 404);
    if (boq.siteId !== parsed.siteId) {
      return ApiError("Selected BOQ does not belong to selected site", 400);
    }

    const existingCombo = await (prisma as any).overallSiteBudget.findFirst({
      where: {
        siteId: parsed.siteId,
        boqId: parsed.boqId,
      },
      select: { id: true },
    });
    if (existingCombo) {
      return ApiError("Overall Site Budget for selected BOQ already exists", 400);
    }

    const boqItemIds = Array.from(new Set<number>((parsed.details || []).map((d) => Number(d.boqItemId)))).filter(
      (v): v is number => Number.isFinite(v) && v > 0
    );

    if (boqItemIds.length) {
      const boqItems = await prisma.boqItem.findMany({
        where: { id: { in: boqItemIds }, boqId: parsed.boqId },
        select: { id: true },
      });
      if (boqItems.length !== boqItemIds.length) {
        return ApiError("One or more BOQ items are invalid for selected BOQ", 400);
      }
    }

    const detailsCreate = (parsed.details || [])
      .map((d) => {
        const itemsCreate = (d.items || [])
          .map((it) => {
            const budgetQty = Number(it.budgetQty || 0);
            const budgetRate = Number(it.budgetRate || 0);
            const purchaseRate = Number(it.purchaseRate || 0);
            return {
              itemId: Number(it.itemId),
              budgetQty: budgetQty as any,
              budgetRate: budgetRate as any,
              purchaseRate: purchaseRate as any,
              budgetValue: (budgetQty * budgetRate) as any,
            };
          })
          .filter((it) => Number.isFinite(Number(it.itemId)) && Number(it.itemId) > 0);

        if (!itemsCreate.length) return null;
        return {
          BoqItemId: Number(d.boqItemId),
          overallSiteBudgetItems: { create: itemsCreate as any },
        };
      })
      .filter(Boolean);

    const created = await (prisma as any).$transaction(async (tx: any) => {
      const createdBudget = await tx.overallSiteBudget.create({
        data: {
          siteId: parsed.siteId,
          boqId: parsed.boqId,
          createdById: (auth as any).user.id,
          updatedById: (auth as any).user.id,
          ...(detailsCreate.length
            ? { overallSiteBudgetDetails: { create: detailsCreate as any } }
            : {}),
        },
        select: {
          id: true,
          siteId: true,
          boqId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return createdBudget;
    });

    return Success(created, 201);
  } catch (err: any) {
    if (err instanceof z.ZodError) return ApiError(err.errors as any, 400);
    console.error("Create overall site budget error:", err);
    return ApiError("Failed to create overall site budget", 500);
  }
}

// PATCH /api/overall-site-budgets - Update Overall Site Budget
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const existing = await (prisma as any).overallSiteBudget.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        siteId: true,
        boqId: true,
      },
    });
    if (!existing) return ApiError("Overall Site Budget not found", 404);

    const nextSiteId = parsed.siteId ?? existing.siteId;
    const nextBoqId = parsed.boqId ?? existing.boqId;

    const boq = await prisma.boq.findUnique({
      where: { id: nextBoqId },
      select: { id: true, siteId: true },
    });
    if (!boq) return ApiError("BOQ not found", 404);
    if (boq.siteId !== nextSiteId) {
      return ApiError("Selected BOQ does not belong to selected site", 400);
    }

    const existingCombo = await (prisma as any).overallSiteBudget.findFirst({
      where: {
        siteId: nextSiteId,
        boqId: nextBoqId,
        id: { not: parsed.id },
      },
      select: { id: true },
    });
    if (existingCombo) {
      return ApiError("Overall Site Budget for selected BOQ already exists", 400);
    }

    if (Array.isArray(parsed.details)) {
      const boqItemIds = Array.from(new Set<number>((parsed.details || []).map((d) => Number(d.boqItemId)))).filter(
        (v): v is number => Number.isFinite(v) && v > 0
      );
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
      await tx.overallSiteBudget.update({
        where: { id: parsed.id },
        data: {
          ...(parsed.siteId !== undefined ? { siteId: nextSiteId } : {}),
          ...(parsed.boqId !== undefined ? { boqId: nextBoqId } : {}),
          updatedById: (auth as any).user.id,
        },
        select: { id: true },
      });

      if (Array.isArray(parsed.details)) {
        const existingDetails = await tx.overallSiteBudgetDetail.findMany({
          where: { overallSiteBudgetId: parsed.id },
          select: {
            id: true,
            BoqItemId: true,
            overallSiteBudgetItems: { select: { id: true, itemId: true } },
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
            }))
            .filter((it) => Number.isFinite(it.itemId) && it.itemId > 0);

          const existingDetail = detailByBoqItemId.get(boqItemId);

          if (!incomingItems.length) {
            if (existingDetail?.id) {
              await tx.overallSiteBudgetItem.deleteMany({
                where: { overallSiteBudgetDetailId: existingDetail.id },
              });
              await tx.overallSiteBudgetDetail.delete({ where: { id: existingDetail.id } });
            }
            continue;
          }

          let detailId = existingDetail?.id as number | undefined;
          if (!detailId) {
            const createdDetail = await tx.overallSiteBudgetDetail.create({
              data: {
                overallSiteBudgetId: parsed.id,
                BoqItemId: boqItemId,
              },
              select: { id: true },
            });
            detailId = createdDetail.id;
          }

          const existingItemsByItemId = new Map<number, number>();
          (existingDetail?.overallSiteBudgetItems || []).forEach((it: any) =>
            existingItemsByItemId.set(Number(it.itemId), Number(it.id))
          );

          const incomingItemIds = new Set<number>();
          for (const it of incomingItems) {
            incomingItemIds.add(it.itemId);
            const budgetValue = it.budgetQty * it.budgetRate;
            const existingItemId = existingItemsByItemId.get(it.itemId);
            if (existingItemId) {
              await tx.overallSiteBudgetItem.update({
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
              await tx.overallSiteBudgetItem.create({
                data: {
                  overallSiteBudgetDetailId: detailId,
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

          const toDeleteIds: number[] = [];
          (existingDetail?.overallSiteBudgetItems || []).forEach((it: any) => {
            const itemId = Number(it.itemId);
            if (!incomingItemIds.has(itemId)) toDeleteIds.push(Number(it.id));
          });
          if (toDeleteIds.length) {
            await tx.overallSiteBudgetItem.deleteMany({ where: { id: { in: toDeleteIds } } });
          }
        }

        const extraDetails = existingDetails.filter((d: any) => !incomingBoqItemIds.has(Number(d.BoqItemId)));
        for (const d of extraDetails) {
          await tx.overallSiteBudgetItem.deleteMany({ where: { overallSiteBudgetDetailId: d.id } });
          await tx.overallSiteBudgetDetail.delete({ where: { id: d.id } });
        }
      }

      return tx.overallSiteBudget.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          siteId: true,
          boqId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return Success(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) return ApiError(err.errors as any, 400);
    console.error("Error updating overall site budget:", err);
    return ApiError("Failed to update overall site budget", 500);
  }
}
