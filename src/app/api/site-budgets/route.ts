import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const createSchema = z.object({
  siteId: z.number().int().positive("Site ID is required"),
  itemId: z.number().int().positive("Item ID is required"),
  budgetQty: z.number().positive("Budget quantity must be positive"),
  budgetRate: z.number().positive("Budget rate must be positive"),
  purchaseRate: z.number().positive("Purchase rate must be positive"),
  qty50Alert: z.boolean().optional().default(false),
  value50Alert: z.boolean().optional().default(false),
  qty75Alert: z.boolean().optional().default(false),
  value75Alert: z.boolean().optional().default(false),
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
  const siteId = searchParams.get("siteId");
  const sort = (searchParams.get("sort") || "createdAt") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  type SiteBudgetWhere = {
    siteId?: number;
    OR?: {
      item?: { item?: { contains: string } };
      site?: { site?: { contains: string } };
    }[];
  };

  const where: SiteBudgetWhere = {};

  // Filter by site if provided
  if (siteId) {
    where.siteId = parseInt(siteId);
  }

  // Search across item name and site name
  if (search) {
    where.OR = [
      { item: { item: { contains: search } } },
      { site: { site: { contains: search } } },
    ];
  }

  const sortableFields = new Set([
    "createdAt",
    "budgetQty",
    "budgetRate",
    "purchaseRate",
    "budgetValue",
  ]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
    ? { [sort]: order }
    : { createdAt: "desc" };

  const result = await paginate({
    model: prisma.siteBudget,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      siteId: true,
      itemId: true,
      budgetQty: true,
      budgetRate: true,
      purchaseRate: true,
      budgetValue: true,
      orderedQty: true,
      avgRate: true,
      orderedValue: true,
      qty50Alert: true,
      value50Alert: true,
      qty75Alert: true,
      value75Alert: true,
      createdAt: true,
      updatedAt: true,
      site: {
        select: {
          id: true,
          site: true,
        },
      },
      item: {
        select: {
          id: true,
          item: true,
          itemCode: true,
          unit: {
            select: {
              id: true,
              unitName: true,
            },
          },
        },
      },
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
    const validatedData = createSchema.parse(body);

    // Calculate budget value; ordered fields are read-only and start at 0
    const budgetValue = validatedData.budgetQty * validatedData.budgetRate;
    const orderedQty = 0;
    const avgRate = 0;
    const orderedValue = 0;

    const created = await prisma.siteBudget.create({
      data: {
        siteId: validatedData.siteId,
        itemId: validatedData.itemId,
        budgetQty: validatedData.budgetQty,
        budgetRate: validatedData.budgetRate,
        purchaseRate: validatedData.purchaseRate,
        orderedQty,
        avgRate,
        qty50Alert: validatedData.qty50Alert,
        value50Alert: validatedData.value50Alert,
        qty75Alert: validatedData.qty75Alert,
        value75Alert: validatedData.value75Alert,
        budgetValue,
        orderedValue,
      },
      select: {
        id: true,
        siteId: true,
        itemId: true,
        budgetQty: true,
        budgetRate: true,
        purchaseRate: true,
        budgetValue: true,
        orderedQty: true,
        avgRate: true,
        orderedValue: true,
        qty50Alert: true,
        value50Alert: true,
        qty75Alert: true,
        value75Alert: true,
        createdAt: true,
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        item: {
          select: {
            id: true,
            item: true,
            itemCode: true,
            unit: {
              select: {
                id: true,
                unitName: true,
              },
            },
          },
        },
      },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return Error(
        "Budget for this site and item combination already exists",
        409
      );
    }
    console.error("Create site budget error:", error);
    return Error("Failed to create site budget");
  }
}
