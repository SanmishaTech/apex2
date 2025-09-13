import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApiAccess } from '@/lib/access-guard';
import { Success, Error } from '@/lib/api-response';

// GET /api/blocks?projectId=1
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url); const pid = Number(searchParams.get('projectId'));
  if (!pid || Number.isNaN(pid)) return Error('projectId required', 400);
  const rows = await prisma.block.findMany({ where: { projectId: pid }, orderBy: { name: 'asc' }, select: { id: true, name: true, projectId: true } });
  return Success(rows);
}

// POST /api/blocks { projectId, name }
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  let body: unknown; try { body = await req.json(); } catch { return Error('Invalid JSON', 400); }
  const raw = (body as Record<string, unknown>) || {};
  const projectId = raw.projectId;
  const name = raw.name;
  if (typeof projectId !== 'number' && typeof projectId !== 'string') return Error('projectId required', 400);
  if (typeof name !== 'string' || !name.trim()) return Error('name required', 400);
  try {
    const created = await prisma.block.create({ data: { projectId: Number(projectId), name: name.trim() }, select: { id: true, name: true, projectId: true } });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'P2002') return Error('Block name already exists in project', 409);
    return Error('Failed to create block');
  }
}
