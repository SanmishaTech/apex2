import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/cashbook-budgets/[id] - Get single budget with items
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const params = await context.params;
  const id = Number(params.id);
  if (!id || isNaN(id)) return Error('Invalid budget ID', 400);

  try {
    const budget = await prisma.cashbookBudget.findUnique({
      where: { id },
      include: {
        budgetItems: {
          include: {
            cashbookHead: {
              select: { id: true, cashbookHeadName: true }
            }
          },
          orderBy: { id: 'asc' }
        },
        site: {
          select: { id: true, site: true }
        },
        boq: {
          select: { id: true, boqNo: true }
        },
        approvedBy_user: {
          select: { id: true, name: true, email: true }
        },
        approved1By_user: {
          select: { id: true, name: true, email: true }
        },
        acceptedBy_user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!budget) return Error('Cashbook budget not found', 404);
    return Success(budget);
  } catch (e: unknown) {
    console.error('Error fetching cashbook budget:', e);
    return Error('Failed to fetch cashbook budget');
  }
}

// DELETE /api/cashbook-budgets/[id]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const params = await context.params;
  const id = Number(params.id);
  if (!id || isNaN(id)) return Error('Invalid budget ID', 400);

  try {
    await prisma.cashbookBudget.delete({
      where: { id },
    });
    return Success({ message: 'Cashbook budget deleted successfully' });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Cashbook budget not found', 404);
    console.error('Error deleting cashbook budget:', e);
    return Error('Failed to delete cashbook budget');
  }
}