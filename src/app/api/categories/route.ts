import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/categories?search=&page=1&perPage=10&sort=categoryName&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "categoryName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  // Build dynamic filter with explicit shape
  type CategoryWhere = {
    categoryName?: { contains: string };
  };
  const where: CategoryWhere = {};
  if (search) {
    where.categoryName = { contains: search };
  }

  // Allow listed sortable fields only
  const sortableFields = new Set(["categoryName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { categoryName: "asc" };

  const result = await paginate({
    model: prisma.category as any,
    where,
    orderBy,
    page,
    perPage,
    select: { id: true, categoryName: true, createdAt: true, updatedAt: true },
  });
  return Success(result);
}

// POST /api/categories  (create category)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { categoryName } = (body as Partial<{ categoryName: string }>) || {};
  if (!categoryName?.trim()) return Error('Category name is required', 400);

  try {
    const created = await prisma.category.create({
      data: { categoryName: categoryName.trim() },
      select: { id: true, categoryName: true, createdAt: true, updatedAt: true }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Category name already exists', 409);
    return Error('Failed to create category');
  }
}

// PATCH /api/categories  { id, categoryName }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, categoryName } = (body as Partial<{ id: number | string; categoryName: string }>) || {};
  if (!id) return Error('Category id required', 400);
  if (!categoryName?.trim()) return Error('Category name is required', 400);

  try {
    const updated = await prisma.category.update({
      where: { id: Number(id) },
      data: { categoryName: categoryName.trim() },
      select: { id: true, categoryName: true, createdAt: true, updatedAt: true }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Category not found', 404);
    if (err?.code === 'P2002') return Error('Category name already exists', 409);
    return Error('Failed to update category');
  }
}
