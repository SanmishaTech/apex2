import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/skill-sets?search=&page=1&perPage=10&sort=skillsetName&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "skillsetName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type SkillSetWhere = {
    skillsetName?: { contains: string };
  };
  const where: SkillSetWhere = {};
  if (search) {
    where.skillsetName = { contains: search };
  }

  const sortableFields = new Set(["skillsetName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { skillsetName: "asc" };

  const result = await paginate({
    model: prisma.skillSet,
    where,
    orderBy,
    page,
    perPage,
    select: { id: true, skillsetName: true, createdAt: true, updatedAt: true },
  });
  return Success(result);
}

// POST /api/skill-sets  (create skill set)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { skillsetName } = (body as Partial<{ skillsetName: string }> ) || {};
  if (!skillsetName?.trim()) return Error('Skill set name is required', 400);

  try {
    const created = await prisma.skillSet.create({
      data: { skillsetName: skillsetName.trim() },
      select: { id: true, skillsetName: true, createdAt: true, updatedAt: true }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Skill set name already exists', 409);
    return Error('Failed to create skill set');
  }
}

// PATCH /api/skill-sets  { id, skillsetName }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, skillsetName } = (body as Partial<{ id: number | string; skillsetName: string }> ) || {};
  if (!id) return Error('Skill set id required', 400);
  if (!skillsetName?.trim()) return Error('Skill set name is required', 400);

  try {
    const updated = await prisma.skillSet.update({
      where: { id: Number(id) },
      data: { skillsetName: skillsetName.trim() },
      select: { id: true, skillsetName: true, createdAt: true, updatedAt: true }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Skill set not found', 404);
    if (err?.code === 'P2002') return Error('Skill set name already exists', 409);
    return Error('Failed to update skill set');
  }
}
