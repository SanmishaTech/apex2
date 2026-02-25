import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/overall-site-budgets/[id] - Get single overall site budget
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid overall site budget ID", 400);

    const overallSiteBudget = await (prisma as any).overallSiteBudget.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        boqId: true,
        boq: { select: { id: true, boqNo: true } },
        createdAt: true,
        updatedAt: true,
        overallSiteBudgetDetails: {
          select: {
            id: true,
            overallSiteBudgetId: true,
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
            overallSiteBudgetItems: {
              select: {
                id: true,
                overallSiteBudgetDetailId: true,
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
      },
    });

    if (!overallSiteBudget) return NotFound("Overall site budget not found");
    return Success(overallSiteBudget);
  } catch (error) {
    console.error("Get overall site budget error:", error);
    return Error("Failed to fetch overall site budget");
  }
}

// DELETE /api/overall-site-budgets/[id] - Delete overall site budget
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid overall site budget ID", 400);

    await (prisma as any).$transaction(async (tx: any) => {
      const details = await tx.overallSiteBudgetDetail.findMany({
        where: { overallSiteBudgetId: id },
        select: { id: true },
      });
      const detailIds = (details || []).map((d: any) => Number(d.id));
      if (detailIds.length) {
        await tx.overallSiteBudgetItem.deleteMany({
          where: { overallSiteBudgetDetailId: { in: detailIds } },
        });
        await tx.overallSiteBudgetDetail.deleteMany({
          where: { id: { in: detailIds } },
        });
      }
      await tx.overallSiteBudget.delete({ where: { id } });
    });

    return Success({ message: "Overall site budget deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Overall site budget not found");
    console.error("Delete overall site budget error:", error);
    return Error("Failed to delete overall site budget");
  }
}
