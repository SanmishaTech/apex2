import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/asset-groups/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const assetGroup = await prisma.assetGroup.findUnique({
      where: { id: idNum },
      select: { id: true, assetGroupName: true, createdAt: true, updatedAt: true }
    });
    if (!assetGroup) return Error('Asset group not found', 404);
    return Success(assetGroup);
  } catch {
    return Error('Failed to fetch asset group');
  }
}

// DELETE /api/asset-groups/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    await prisma.assetGroup.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Asset group not found', 404);
    return Error('Failed to delete asset group');
  }
}