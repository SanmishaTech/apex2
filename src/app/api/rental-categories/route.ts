import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/rental-categories?search=&page=1&perPage=10&sort=rentalCategory&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "rentalCategory") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    type Where = { rentalCategory?: { contains: string } };
    const where: Where = {};
    if (search) where.rentalCategory = { contains: search };

    const sortable = new Set(["rentalCategory", "createdAt", "updatedAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) ? { [sort]: order } : { rentalCategory: "asc" };

    const result = await paginate({
      model: prisma.rentalCategory,
      where,
      orderBy,
      page,
      perPage,
      select: { id: true, rentalCategory: true, createdAt: true, updatedAt: true },
    });

    return Success({
      data: result.data,
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (e) {
    return Error("Failed to fetch rental categories");
  }
}

// POST /api/rental-categories  (create)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { rentalCategory } = (body as Partial<{ rentalCategory: string }>) || {};
  if (!rentalCategory?.trim()) return Error('Rental category is required', 400);

  try {
    const created = await prisma.rentalCategory.create({
      data: { rentalCategory: rentalCategory.trim() },
      select: { id: true, rentalCategory: true, createdAt: true, updatedAt: true },
    });
    return Success(created, 201);
  } catch (e: any) {
    if (e?.code === 'P2002') return Error('Rental category already exists', 409);
    return Error('Failed to create rental category');
  }
}

// PATCH /api/rental-categories  { id, rentalCategory }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, rentalCategory } = (body as Partial<{ id: number | string; rentalCategory: string }>) || {};
  if (!id) return Error('Id is required', 400);
  if (!rentalCategory?.trim()) return Error('Rental category is required', 400);

  try {
    const updated = await prisma.rentalCategory.update({
      where: { id: Number(id) },
      data: { rentalCategory: rentalCategory.trim() },
      select: { id: true, rentalCategory: true, createdAt: true, updatedAt: true },
    });
    return Success(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Rental category not found', 404);
    if (e?.code === 'P2002') return Error('Rental category already exists', 409);
    return Error('Failed to update rental category');
  }
}
