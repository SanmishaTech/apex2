import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/units?search=&page=1&perPage=10&sort=unitName&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "unitName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type UnitWhere = {
    unitName?: { contains: string };
  };
  const where: UnitWhere = {};
  if (search) {
    where.unitName = { contains: search };
  }

  const sortableFields = new Set(["unitName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { unitName: "asc" };

  const result = await paginate({
    model: prisma.unit,
    where,
    orderBy,
    page,
    perPage,
    select: { id: true, unitName: true, createdAt: true, updatedAt: true },
  });
  return Success(result);
}

// POST /api/units  (create unit)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { unitName } = (body as Partial<{ unitName: string }> ) || {};
  if (!unitName?.trim()) return Error('Unit name is required', 400);

  try {
    const created = await prisma.unit.create({
      data: { unitName: unitName.trim() },
      select: { id: true, unitName: true, createdAt: true, updatedAt: true }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Unit name already exists', 409);
    return Error('Failed to create unit');
  }
}

// PATCH /api/units  { id, unitName }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, unitName } = (body as Partial<{ id: number | string; unitName: string }> ) || {};
  if (!id) return Error('Unit id required', 400);
  if (!unitName?.trim()) return Error('Unit name is required', 400);

  try {
    const updated = await prisma.unit.update({
      where: { id: Number(id) },
      data: { unitName: unitName.trim() },
      select: { id: true, unitName: true, createdAt: true, updatedAt: true }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Unit not found', 404);
    if (err?.code === 'P2002') return Error('Unit name already exists', 409);
    return Error('Failed to update unit');
  }
}
