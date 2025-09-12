import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/minimum-wages/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const rec = await prisma.minimumWage.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        siteId: true,
        categoryId: true,
        skillSetId: true,
        minWage: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true, shortName: true } },
        category: { select: { id: true, categoryName: true } },
        skillSet: { select: { id: true, skillsetName: true } },
      }
    });
    if (!rec) return Error('Not found', 404);
    return Success(rec);
  } catch {
    return Error('Failed to fetch minimum wage');
  }
}

// DELETE /api/minimum-wages/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    await prisma.minimumWage.delete({ where: { id: idNum } });
    return Success({ id: idNum });
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Not found', 404);
    return Error('Failed to delete minimum wage');
  }
}
