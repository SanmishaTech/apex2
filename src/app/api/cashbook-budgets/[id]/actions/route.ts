import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, Forbidden } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS, ROLES } from "@/config/roles";

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

    // Permission checks per action
    const permSet = new Set((auth.user.permissions || []) as string[]);
    if (action === "approve_1") {
      if (!permSet.has(PERMISSIONS.APPROVE_CASHBOOK_BUDGETS_L1)) {
        return Forbidden("Missing permission to approve cashbook budget (Level 1)");
      }
    }
    if (action === "approve") {
      if (!permSet.has(PERMISSIONS.APPROVE_CASHBOOK_BUDGETS_L2)) {
        return Forbidden("Missing permission to approve cashbook budget (Level 2)");
      }
    }
    if (action === "accept") {
      if (!permSet.has(PERMISSIONS.ACCEPT_CASHBOOK_BUDGETS)) {
        return Forbidden("Missing permission to accept cashbook budget");
      }
    }

    if (auth.user.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: {
          id: true,
          siteEmployees: { select: { siteId: true } },
        },
      });

      if (!employee) {
        return Forbidden("Employee record not found for current user");
      }

      const assignedSiteIds: number[] = (employee.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      if (typeof budget.siteId !== "number" || !assignedSiteIds.includes(budget.siteId)) {
        return Forbidden("Site is not assigned to current user");
      }
    }

    // Handle different actions
    if (action === 'approve') {
      // Level 2 approval workflow
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

      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        // Update each budget item with approved amount
        for (const item of budgetItems) {
          const itemUpdate: any = {
            approvedAmount: Number(item.approvedAmount || 0),
          };
          // If Approval 1 was not done, also set its amount to the same value
          if (!budget.approved1By) {
            itemUpdate.approved1Amount = Number(item.approvedAmount || 0);
          }
          await tx.cashbookBudgetItem.update({
            where: { id: item.id },
            data: itemUpdate,
          });
        }

        const budgetUpdate: any = {
          approvedBy: auth.user.id,
          approvedDatetime: now,
          approvedBudgetAmount: totalApprovedAmount,
          totalBudget: totalBudgetAmount,
        };

        // If Approval 1 was not done, auto-mark it
        if (!budget.approved1By) {
          budgetUpdate.approved1By = auth.user.id;
          budgetUpdate.approved1Datetime = now;
          budgetUpdate.approved1BudgetAmount = totalApprovedAmount;
        }

        // Update budget header
        return tx.cashbookBudget.update({
          where: { id: budgetId },
          data: budgetUpdate,
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
      // Level 1 approval workflow
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
      const now = new Date();
      const userId = auth.user.id;

      const updated = await prisma.$transaction(async (tx) => {
        const budgetUpdate: any = {
          acceptedBy: userId,
          acceptedDatetime: now,
        };

        // If Level 2 approval not done, auto-mark it
        if (!budget.approvedBy) {
          const totalAmount = budget.budgetItems.reduce((sum, item) => sum + Number(item.amount), 0);
          
          budgetUpdate.approvedBy = userId;
          budgetUpdate.approvedDatetime = now;
          budgetUpdate.approvedBudgetAmount = totalAmount;

          // If Level 1 also not done
          if (!budget.approved1By) {
            budgetUpdate.approved1By = userId;
            budgetUpdate.approved1Datetime = now;
            budgetUpdate.approved1BudgetAmount = totalAmount;
          }

          // Update items
          for (const item of budget.budgetItems) {
            const itemUpdate: any = {
              approvedAmount: item.amount,
            };
            if (!budget.approved1By) {
              itemUpdate.approved1Amount = item.amount;
            }
            await tx.cashbookBudgetItem.update({
              where: { id: item.id },
              data: itemUpdate,
            });
          }
        }

        return tx.cashbookBudget.update({
          where: { id: budgetId },
          data: budgetUpdate,
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

    return Error('Invalid action', 400);
  } catch (e: unknown) {
    console.error('Error processing cashbook budget action:', e);
    return Error('Failed to process action');
  }
}
