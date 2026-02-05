import type { Prisma } from "@prisma/client";

export const applyBudgetValidation = false;

export type BudgetQtyViolation = {
  itemId: number;
  budgetQty: number;
  orderedQty: number;
  availableQty: number;
  requestedQty: number;
  message: string;
};

export async function validateSiteBoqBudgetQtyForItems(params: {
  tx: Prisma.TransactionClient;
  siteId: number;
  boqId: number;
  items: Array<{ itemId: number; qty: number }>;
  excludePurchaseOrderId?: number;
}): Promise<BudgetQtyViolation[]> {
  const { tx, siteId, boqId, items, excludePurchaseOrderId } = params;

  const uniqueItemIds = Array.from(
    new Set(
      (items || [])
        .map((i) => Number(i.itemId))
        .filter((v) => Number.isFinite(v) && v > 0)
    )
  );

  if (!Number.isFinite(siteId) || siteId <= 0) return [];
  if (!Number.isFinite(boqId) || boqId <= 0) return [];
  if (uniqueItemIds.length === 0) return [];

  const budgetRows = await (tx as any).siteBudgetItem.groupBy({
    by: ["itemId"],
    where: {
      itemId: { in: uniqueItemIds },
      siteBudgetDetail: {
        siteBudget: {
          siteId,
          boqId,
        },
      },
    },
    _sum: {
      budgetQty: true,
    },
  });

  const budgetQtyByItemId = new Map<number, number>();
  for (const r of budgetRows || []) {
    const itemId = Number((r as any).itemId);
    const qty = Number((r as any)?._sum?.budgetQty || 0);
    if (Number.isFinite(itemId)) budgetQtyByItemId.set(itemId, qty);
  }

  const poWhere: any = {
    purchaseOrder: {
      siteId,
      boqId,
      isSuspended: false,
    },
    itemId: { in: uniqueItemIds },
  };
  if (excludePurchaseOrderId && Number.isFinite(excludePurchaseOrderId)) {
    poWhere.purchaseOrder = {
      ...poWhere.purchaseOrder,
      id: { not: excludePurchaseOrderId },
    };
  }

  const orderedRows = await (tx as any).purchaseOrderDetail.groupBy({
    by: ["itemId"],
    where: poWhere,
    _sum: {
      qty: true,
    },
  });

  const orderedQtyByItemId = new Map<number, number>();
  for (const r of orderedRows || []) {
    const itemId = Number((r as any).itemId);
    const qty = Number((r as any)?._sum?.qty || 0);
    if (Number.isFinite(itemId)) orderedQtyByItemId.set(itemId, qty);
  }

  const violations: BudgetQtyViolation[] = [];

  for (const line of items || []) {
    const itemId = Number(line.itemId);
    const requestedQty = Number(line.qty || 0);
    if (!Number.isFinite(itemId) || itemId <= 0) continue;
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) continue;

    const budgetQty = Number(budgetQtyByItemId.get(itemId) || 0);
    const orderedQty = Number(orderedQtyByItemId.get(itemId) || 0);

    const availableQty = Number((budgetQty - orderedQty).toFixed(4));
    const availableQtyForDisplay = Math.max(0, availableQty);
    if (budgetQty <= 0 && requestedQty > 0) {
      violations.push({
        itemId,
        budgetQty,
        orderedQty,
        availableQty,
        requestedQty,
        message: `${orderedQty.toFixed(2)}/${budgetQty.toFixed(2)}, available:${availableQtyForDisplay.toFixed(2)}`,
      });
      continue;
    }

    if (requestedQty > availableQty + 1e-9) {
      violations.push({
        itemId,
        budgetQty,
        orderedQty,
        availableQty,
        requestedQty,
        message: `${orderedQty.toFixed(2)}/${budgetQty.toFixed(2)}, available:${availableQtyForDisplay.toFixed(2)}`,
      });
    }
  }

  return violations;
}

export function formatBudgetQtyViolationsForBadRequest(
  violations: BudgetQtyViolation[]
) {
  const parts = (violations || []).map(
    (v) => `${v.itemId}: ${v.message || "Item limit exceeded"}`
  );
  return `Item limit exceeded -> ${parts.join(", ")}`;
}
