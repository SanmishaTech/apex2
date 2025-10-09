import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
 
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/asset-groups?search=&page=1&perPage=10&sort=assetGroupName&order=asc
 export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
 
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "assetGroupName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type AssetGroupWhere = {
    assetGroupName?: { contains: string };
  };
  const where: AssetGroupWhere = {};
  if (search) {
    where.assetGroupName = { contains: search };
  }

  const sortableFields = new Set(["assetGroupName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { assetGroupName: "asc" };

  const result = await paginate({
    model: prisma.assetGroup as any,
    where,
    orderBy,
    page,
    perPage,
    select: { id: true, assetGroupName: true, createdAt: true, updatedAt: true },
  });
  return Success(result);
}

// POST /api/asset-groups  (create asset group)
 export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
 
  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { assetGroupName } = (body as Partial<{ assetGroupName: string }> ) || {};
  if (!assetGroupName?.trim()) return Error('Asset group name is required', 400);

  try {
    const created = await prisma.assetGroup.create({
      data: { assetGroupName: assetGroupName.trim() },
      select: { id: true, assetGroupName: true, createdAt: true, updatedAt: true }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Asset group name already exists', 409);
    return Error('Failed to create asset group');
  }
}

// PATCH /api/asset-groups  { id, assetGroupName }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, assetGroupName } = (body as Partial<{ id: number | string; assetGroupName: string }> ) || {};
  if (!id) return Error('Asset group id required', 400);
  if (!assetGroupName?.trim()) return Error('Asset group name is required', 400);

  try {
    const updated = await prisma.assetGroup.update({
      where: { id: Number(id) },
      data: { assetGroupName: assetGroupName.trim() },
      select: { id: true, assetGroupName: true, createdAt: true, updatedAt: true }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Asset group not found', 404);
    if (err?.code === 'P2002') return Error('Asset group name already exists', 409);
    return Error('Failed to update asset group');
  }
}
 