import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/design-maps/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  const { id } = await context.params; const did = Number(id); if (Number.isNaN(did)) return Error('Invalid id', 400);
  try {
    const map = await prisma.designMap.findUnique({ where: { id: did } });
    if (!map) return Error('Not found', 404);
    return Success(map);
  } catch { return Error('Failed to fetch design map'); }
}

// PATCH /api/design-maps/:id body: { x?, y?, width?, height? }
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  const { id } = await context.params; const did = Number(id); if (Number.isNaN(did)) return Error('Invalid id', 400);
  let body: unknown; try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { x, y, width, height, crackIdentificationId } = body as Partial<{ x: number; y: number; width: number; height: number; crackIdentificationId: number }>;
  const data: Record<string, number> = {};
  if (typeof x === 'number') data.x = x;
  if (typeof y === 'number') data.y = y;
  if (typeof width === 'number') data.width = width;
  if (typeof height === 'number') data.height = height;
  try {
    // If updating association, validate crack belongs to same project and is not already mapped
    if (typeof crackIdentificationId === 'number') {
      const existing = await prisma.designMap.findUnique({ where: { id: did }, select: { id: true, projectId: true } });
      if (!existing) return Error('Not found', 404);
      const crack = await prisma.crackIdentification.findUnique({ where: { id: crackIdentificationId }, select: { id: true, projectId: true } });
      if (!crack || crack.projectId !== existing.projectId) return Error('crackIdentificationId does not belong to this project', 400);
      // include in update data
      (data as Record<string, number>).crackIdentificationId = crackIdentificationId;
    }
    if (Object.keys(data).length === 0) return Error('Nothing to update', 400);
    const updated = await prisma.designMap.update({ where: { id: did }, data });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'P2002') return Error('Design map already exists for selected crack', 409);
    return Error('Failed to update design map');
  }
}

// DELETE /api/design-maps/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req); if (auth.ok === false) return auth.response;
  const { id } = await context.params; const did = Number(id); if (Number.isNaN(did)) return Error('Invalid id', 400);
  try { await prisma.designMap.delete({ where: { id: did } }); return Success({ id: did }); } catch { return Error('Failed to delete design map'); }
}
