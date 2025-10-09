import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/cashbook-heads?search=&page=1&perPage=10&sort=cashbookHeadName&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "cashbookHeadName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  // Build dynamic filter with explicit shape
  type CashbookHeadWhere = {
    cashbookHeadName?: { contains: string };
  };
  const where: CashbookHeadWhere = {};
  if (search) {
    where.cashbookHeadName = { contains: search };
  }

  // Allow listed sortable fields only
  const sortableFields = new Set(["cashbookHeadName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { cashbookHeadName: "asc" };

  const result = await paginate({
    model: prisma.cashbookHead as any,
    where,
    orderBy,
    page,
    perPage,
    select: { id: true, cashbookHeadName: true, createdAt: true, updatedAt: true },
  });
  return Success(result);
}

// POST /api/cashbook-heads  (create cashbook head)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { cashbookHeadName } = (body as Partial<{ cashbookHeadName: string }>) || {};
  if (!cashbookHeadName?.trim()) return Error('Cashbook head name is required', 400);

  try {
    const created = await prisma.cashbookHead.create({
      data: { cashbookHeadName: cashbookHeadName.trim() },
      select: { id: true, cashbookHeadName: true, createdAt: true, updatedAt: true }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Cashbook head name already exists', 409);
    return Error('Failed to create cashbook head');
  }
}

// PATCH /api/cashbook-heads  { id, cashbookHeadName }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, cashbookHeadName } = (body as Partial<{ id: number | string; cashbookHeadName: string }>) || {};
  if (!id) return Error('Cashbook head id required', 400);
  if (!cashbookHeadName?.trim()) return Error('Cashbook head name is required', 400);

  try {
    const updated = await prisma.cashbookHead.update({
      where: { id: Number(id) },
      data: { cashbookHeadName: cashbookHeadName.trim() },
      select: { id: true, cashbookHeadName: true, createdAt: true, updatedAt: true }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Cashbook head not found', 404);
    if (err?.code === 'P2002') return Error('Cashbook head name already exists', 409);
    return Error('Failed to update cashbook head');
  }
}