 
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/asset-categories/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const assetCategory = await prisma.assetCategory.findUnique({
      where: { id: idNum },
      select: { 
        id: true, 
        category: true, 
        assetGroupId: true,
        assetGroup: { select: { assetGroupName: true } },
        createdAt: true, 
        updatedAt: true 
      }
    });
    if (!assetCategory) return Error('Asset category not found', 404);
    return Success(assetCategory);
  } catch {
    return Error('Failed to fetch asset category');
  }
}

// DELETE /api/asset-categories/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    await prisma.assetCategory.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Asset category not found', 404);
    return Error('Failed to delete asset category');
  }
}
