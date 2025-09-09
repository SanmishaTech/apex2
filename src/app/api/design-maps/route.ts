import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/design-maps?projectId=&crackIdentificationId=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url);
  const projectId = Number(searchParams.get('projectId'));
  const crackIdentificationId = searchParams.get('crackIdentificationId') ? Number(searchParams.get('crackIdentificationId')) : undefined;
  if (!projectId) return Error('projectId required', 400);
  const where: { projectId: number; crackIdentificationId?: number } = { projectId };
  if (crackIdentificationId) where.crackIdentificationId = crackIdentificationId;
  try {
    const maps = await prisma.designMap.findMany({ where, orderBy: { id: 'asc' } });
    return Success({ items: maps });
  } catch { return Error('Failed to fetch design maps'); }
}

// POST /api/design-maps
// Body: { projectId, crackIdentificationId, x, y, width, height }
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  let body: unknown; try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { projectId, crackIdentificationId, x, y, width, height } = body as Partial<{ projectId: number; crackIdentificationId: number; x: number; y: number; width: number; height: number; }>;
  if (!projectId) return Error('projectId required', 400);
  if (!crackIdentificationId) return Error('crackIdentificationId required', 400);
  const coords = [x, y, width, height];
  if (coords.some(v => v === null || v === undefined || typeof v !== 'number')) return Error('x,y,width,height required', 400);
  try {
    // Ensure crackIdentification belongs to project
    const crack = await prisma.crackIdentification.findUnique({ where: { id: crackIdentificationId }, select: { projectId: true } });
    if (!crack || crack.projectId !== projectId) return Error('Crack not found in project', 404);
    const created = await prisma.designMap.create({ data: { projectId, crackIdentificationId, x: x!, y: y!, width: width!, height: height! } });
    return Success(created, 201);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2002') return Error('Design map already exists for crack', 409);
    return Error('Failed to create design map');
  }
}

// DELETE /api/design-maps?id=123 or JSON { id }
export async function DELETE(req: NextRequest) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  let id: number | null = null;
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await req.json()) as Partial<{ id: number | string }>;
      if (body?.id != null) id = Number(body.id);
    } catch { /* fall through */ }
  }
  if (id == null || Number.isNaN(id)) {
    const { searchParams } = new URL(req.url);
    const qp = searchParams.get('id');
    if (qp) id = Number(qp);
  }
  if (id == null || Number.isNaN(id)) return Error('id required', 400);
  try {
    await prisma.designMap.delete({ where: { id } });
    return Success({ id });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return Error('Not found', 404);
    return Error('Failed to delete design map');
  }
}
