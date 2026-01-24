import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/site-budgets/[id] - Get single site budget
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid site budget ID", 400);

    const siteBudget = await (prisma as any).siteBudget.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        boqId: true,
        boq: { select: { id: true, boqNo: true } },
        month: true,
        week: true,
        fromDate: true,
        toDate: true,
        createdAt: true,
        updatedAt: true,
        siteBudgetDetails: {
          select: {
            id: true,
            SiteBudgetId: true,
            BoqItemId: true,
            boqItem: {
              select: {
                id: true,
                activityId: true,
                clientSrNo: true,
                item: true,
                unit: { select: { unitName: true } },
                qty: true,
                rate: true,
                amount: true,
                isGroup: true,
              },
            },
            siteBudgetItems: {
              select: {
                id: true,
                SiteBudgetDetailId: true,
                itemId: true,
                item: {
                  select: {
                    id: true,
                    item: true,
                    itemCode: true,
                    unit: { select: { unitName: true } },
                  },
                },
                budgetQty: true,
                budgetRate: true,
                purchaseRate: true,
                budgetValue: true,
              },
              orderBy: { itemId: "asc" },
            },
          },
          orderBy: { BoqItemId: "asc" },
        },
      }
    });

    if (!siteBudget) return NotFound('Site budget not found');
    return Success(siteBudget);
  } catch (error) {
    console.error("Get site budget error:", error);
    return Error("Failed to fetch site budget");
  }
}

// DELETE /api/site-budgets/[id] - Delete site budget
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid site budget ID", 400);

    await (prisma as any).$transaction(async (tx: any) => {
      const details = await tx.siteBudgetDetail.findMany({
        where: { SiteBudgetId: id },
        select: { id: true },
      });
      const detailIds = (details || []).map((d: any) => Number(d.id));
      if (detailIds.length) {
        await tx.siteBudgetItem.deleteMany({
          where: { SiteBudgetDetailId: { in: detailIds } },
        });
        await tx.siteBudgetDetail.deleteMany({
          where: { id: { in: detailIds } },
        });
      }
      await tx.siteBudget.delete({ where: { id } });
    });

    return Success({ message: "Site budget deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2025') return NotFound('Site budget not found');
    console.error("Delete site budget error:", error);
    return Error("Failed to delete site budget");
  }
}
