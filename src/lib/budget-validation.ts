import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export async function validateBudgetQuantities(
  siteId: number,
  items: { id?: number; itemId: number; indentQty: number; approved1Qty?: number; approved2Qty?: number }[],
  indentId?: number
) {
  for (const item of items) {
    const itemData = await prisma.item.findUnique({ where: { id: item.itemId }, select: { item: true } });
    const itemName = itemData?.item || `Item ID ${item.itemId}`;

    // 1. Get budget qty
    const budgetItem = await prisma.overallSiteBudgetItem.aggregate({
      _sum: {
        budgetQty: true
      },
      where: {
        itemId: item.itemId,
        overallSiteBudgetDetail: {
          overallSiteBudget: { siteId }
        }
      }
    });

    if (budgetItem._sum.budgetQty === null) {
      throw new Error(`BAD_REQUEST: Item '${itemName}' is not present in the overall site budget or has no budget quantity.`);
    }

    const budgetQty = Number(budgetItem._sum.budgetQty);

    // 2. Get used qty
    const whereClause: Prisma.IndentItemWhereInput = {
      itemId: item.itemId,
      indent: { siteId }
    };

    if (indentId) {
      whereClause.indentId = { not: indentId };
    }

    const existingIndents = await prisma.indentItem.aggregate({
      _sum: {
        indentQty: true
      },
      where: whereClause
    });

    const usedQty = Number(existingIndents._sum.indentQty || 0);
    const availableQty = budgetQty - usedQty;

    if (item.indentQty > availableQty) {
      throw new Error(`BAD_REQUEST: Indent quantity (${item.indentQty}) exceeds available budget quantity (${availableQty}) for Item '${itemName}'.`);
    }
    if (item.approved1Qty !== undefined && item.approved1Qty > availableQty) {
      throw new Error(`BAD_REQUEST: Approved 1 quantity (${item.approved1Qty}) exceeds available budget quantity (${availableQty}) for Item '${itemName}'.`);
    }
    if (item.approved2Qty !== undefined && item.approved2Qty > availableQty) {
      throw new Error(`BAD_REQUEST: Approved 2 quantity (${item.approved2Qty}) exceeds available budget quantity (${availableQty}) for Item '${itemName}'.`);
    }
  }
}
