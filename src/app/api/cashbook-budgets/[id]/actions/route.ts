import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, Forbidden } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// POST /api/cashbook-budgets/[id]/actions - Handle approve, approve_1, and accept actions
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await params;
  const budgetId = Number(id);
  if (!budgetId || isNaN(budgetId)) return Error('Invalid budget ID', 400);

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  
  const { action, budgetItems } = (body as Partial<{
    action: 'approve' | 'approve_1' | 'accept';
    budgetItems?: Array<{ 
      id: number; 
      approvedAmount?: string | number;
      approved1Amount?: string | number;
    }>;
  }>) || {};

  if (!action) return Error('Action is required', 400);

  try {
    const budget = await prisma.cashbookBudget.findUnique({
      where: { id: budgetId },
      include: { budgetItems: true },
    });

    if (!budget) return Error('Cashbook budget not found', 404);

    if (auth.user.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      if (typeof budget.siteId !== "number" || !assignedSiteIds.includes(budget.siteId)) {
        return Forbidden("Site is not assigned to current user");
      }
    }

    // Handle different actions
    if (action === 'approve') {
      // First approval workflow
      if (!budgetItems || budgetItems.length === 0) {
        return Error('Budget items with approved amounts are required', 400);
      }

      // Calculate total approved amount
      const totalApprovedAmount = budgetItems.reduce((sum, item) => {
        return sum + Number(item.approvedAmount || 0);
      }, 0);

      // Calculate total budget amount from existing items
      const totalBudgetAmount = budget.budgetItems.reduce((sum, item) => {
        return sum + Number(item.amount);
      }, 0);

      // Update budget header with approval info
      const updated = await prisma.$transaction(async (tx) => {
        // Update each budget item with approved amount
        for (const item of budgetItems) {
          await tx.cashbookBudgetItem.update({
            where: { id: item.id },
            data: {
              approvedAmount: Number(item.approvedAmount || 0),
            },
          });
        }

        // Update budget header
        return tx.cashbookBudget.update({
          where: { id: budgetId },
          data: {
            approvedBy: auth.user.id,
            approvedDatetime: new Date(),
            approvedBudgetAmount: totalApprovedAmount,
            totalBudget: totalBudgetAmount,
          },
          include: {
            budgetItems: {
              include: {
                cashbookHead: {
                  select: { id: true, cashbookHeadName: true }
                }
              }
            },
            site: {
              select: { id: true, site: true }
            },
            boq: {
              select: { id: true, boqNo: true }
            }
          }
        });
      });

      return Success(updated);
    }

    if (action === 'approve_1') {
      // Second approval workflow
      if (!budgetItems || budgetItems.length === 0) {
        return Error('Budget items with approved amounts are required', 400);
      }

      // Calculate total approved1 amount
      const totalApproved1Amount = budgetItems.reduce((sum, item) => {
        return sum + Number(item.approved1Amount || 0);
      }, 0);

      // Calculate total budget amount from existing items
      const totalBudgetAmount = budget.budgetItems.reduce((sum, item) => {
        return sum + Number(item.amount);
      }, 0);

      // Update budget header with approval1 info
      const updated = await prisma.$transaction(async (tx) => {
        // Update each budget item with approved1 amount
        for (const item of budgetItems) {
          await tx.cashbookBudgetItem.update({
            where: { id: item.id },
            data: {
              approved1Amount: Number(item.approved1Amount || 0),
            },
          });
        }

        // Update budget header
        return tx.cashbookBudget.update({
          where: { id: budgetId },
          data: {
            approved1By: auth.user.id,
            approved1Datetime: new Date(),
            approved1BudgetAmount: totalApproved1Amount,
            totalBudget: totalBudgetAmount,
          },
          include: {
            budgetItems: {
              include: {
                cashbookHead: {
                  select: { id: true, cashbookHeadName: true }
                }
              }
            },
            site: {
              select: { id: true, site: true }
            },
            boq: {
              select: { id: true, boqNo: true }
            }
          }
        });
      });

      return Success(updated);
    }

    if (action === 'accept') {
      // Acceptance workflow
      const updated = await prisma.cashbookBudget.update({
        where: { id: budgetId },
        data: {
          acceptedBy: auth.user.id,
          acceptedDatetime: new Date(),
        },
        include: {
          budgetItems: {
            include: {
              cashbookHead: {
                select: { id: true, cashbookHeadName: true }
              }
            }
          },
          site: {
            select: { id: true, site: true }
          },
          boq: {
            select: { id: true, boqNo: true }
          }
        }
      });

      return Success(updated);
    }

    return Error('Invalid action', 400);
  } catch (e: unknown) {
    console.error('Error processing cashbook budget action:', e);
    return Error('Failed to process action');
  }
}
