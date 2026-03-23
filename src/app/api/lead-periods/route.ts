import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { Prisma } from "@prisma/client";

// GET /api/lead-periods?siteId=1&search=itemname&page=1&perPage=10
export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_LEAD_PERIODS]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const siteId = searchParams.get("siteId") ? Number(searchParams.get("siteId")) : undefined;
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (siteId) where.siteId = siteId;
  
  if (search) {
    where.OR = [
      { site: { site: { contains: search } } },
      {
        leadPeriodDetails: {
          some: {
            OR: [
              { item: { item: { contains: search } } },
              { item: { itemCode: { contains: search } } },
            ],
          },
        },
      },
    ];
  }

  const result = await paginate({
    model: prisma.leadPeriod,
    where,
    select: {
      id: true,
      siteId: true,
      site: { select: { site: true } },
      createdAt: true,
      updatedAt: true,
      _count: { select: { leadPeriodDetails: true } },
    },
    orderBy: { updatedAt: "desc" },
    page,
    perPage,
  });

    const response = {
      data: result.data,
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages
      }
    };

    return Success(response);
}

// POST /api/lead-periods (Bulk Upsert for a Site)
export async function POST(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.CREATE_LEAD_PERIODS]);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }

  const { siteId, items } = body as { siteId: number; items: { itemId: number; period: number }[] };

  if (!siteId) return Error("Site is required", 400);
  if (!items || !Array.isArray(items)) return Error("Items are required", 400);

  try {
    const userId = auth.user.id;
    const existing = await prisma.leadPeriod.findUnique({ where: { siteId: Number(siteId) }, select: { id: true } });
    if (existing) return Error("Lead period for this site already exist", 400);
    
    const result = await prisma.$transaction(async (tx) => {
      const lp = await tx.leadPeriod.create({
        data: {
          siteId: Number(siteId),
          createdById: userId,
          updatedById: userId,
        },
      });

      for (const item of items) {
        await tx.leadPeriodDetail.create({
          data: {
            leadPeriodId: lp.id,
            itemId: Number(item.itemId),
            period: Number(item.period),
          },
        });
      }

      return lp;
    });

    return Success(result, 201);
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Error("Lead period for this site already exist", 400);
    }
    console.error("Lead Period Upsert Error:", e);
    return Error("Failed to save lead periods");
  }
}
