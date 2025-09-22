import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/cashbook-heads/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const cashbookHead = await prisma.cashbookHead.findUnique({
      where: { id: idNum },
      select: { id: true, cashbookHeadName: true, createdAt: true, updatedAt: true }
    });
    if (!cashbookHead) return Error('Cashbook head not found', 404);
    return Success(cashbookHead);
  } catch {
    return Error('Failed to fetch cashbook head');
  }
}

// DELETE /api/cashbook-heads/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    await prisma.cashbookHead.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Cashbook head not found', 404);
    return Error('Failed to delete cashbook head');
  }
}