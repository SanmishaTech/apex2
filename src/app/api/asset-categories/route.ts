import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
 
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/asset-categories?search=&page=1&perPage=10&sort=category&order=asc&assetGroupId=
 export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
 
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "category") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";
  const assetGroupId = searchParams.get("assetGroupId");

  type AssetCategoryWhere = {
    category?: { contains: string };
    assetGroupId?: number;
  };
  const where: AssetCategoryWhere = {};
  if (search) {
    where.category = { contains: search };
  }
  if (assetGroupId) {
    where.assetGroupId = Number(assetGroupId);
  }

  const sortableFields = new Set(["category", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { category: "asc" };

  const result = await paginate({
    model: prisma.assetCategory,
    where,
    orderBy,
    page,
    perPage,
    select: { 
      id: true, 
      category: true, 
      assetGroupId: true,
      assetGroup: { select: { assetGroupName: true } },
      createdAt: true, 
      updatedAt: true 
    },
  });
  return Success(result);
}

// POST /api/asset-categories  (create asset category)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { category, assetGroupId } = (body as Partial<{ category: string; assetGroupId: number }> ) || {};
  if (!category?.trim()) return Error('Category is required', 400);
  if (!assetGroupId) return Error('Asset group is required', 400);

  try {
    const created = await prisma.assetCategory.create({
      data: { 
        category: category.trim(),
        assetGroupId: Number(assetGroupId)
      },
      select: { 
        id: true, 
        category: true, 
        assetGroupId: true,
        assetGroup: { select: { assetGroupName: true } },
        createdAt: true, 
        updatedAt: true 
      }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Category already exists for this asset group', 409);
    if (err?.code === 'P2003') return Error('Invalid asset group', 400);
    return Error('Failed to create asset category');
  }
}

// PATCH /api/asset-categories  { id, category, assetGroupId }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, category, assetGroupId } = (body as Partial<{ id: number | string; category: string; assetGroupId: number }> ) || {};
  if (!id) return Error('Asset category id required', 400);
  if (!category?.trim()) return Error('Category is required', 400);
  if (!assetGroupId) return Error('Asset group is required', 400);

  try {
    const updated = await prisma.assetCategory.update({
      where: { id: Number(id) },
      data: { 
        category: category.trim(),
        assetGroupId: Number(assetGroupId)
      },
      select: { 
        id: true, 
        category: true, 
        assetGroupId: true,
        assetGroup: { select: { assetGroupName: true } },
        createdAt: true, 
        updatedAt: true 
      }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Asset category not found', 404);
    if (err?.code === 'P2002') return Error('Category already exists for this asset group', 409);
    if (err?.code === 'P2003') return Error('Invalid asset group', 400);
    return Error('Failed to update asset category');
  }
}
 