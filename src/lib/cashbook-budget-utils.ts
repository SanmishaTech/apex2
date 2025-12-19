import { prisma } from "@/lib/prisma";

function getMonthStringFromDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${year}`;
}

function getMonthRange(monthStr: string): { start: Date; end: Date } {
  // monthStr format: MM-YYYY
  const [mm, yyyy] = monthStr.split("-");
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0); // exclusive
  return { start, end };
}

export async function recomputeBudgetForContext(params: {
  siteId: number | null;
  boqId: number | null;
  month: string; // MM-YYYY
  cashbookHeadIds: number[]; // at least one
}) {
  const { siteId, boqId, month, cashbookHeadIds } = params;
  if (!month || cashbookHeadIds.length === 0) return;

  const budget = await prisma.cashbookBudget.findFirst({
    where: {
      month,
      siteId: siteId ?? null,
      boqId: boqId ?? null,
    },
    select: { id: true },
  });

  if (!budget) return; // nothing to update

  const { start, end } = getMonthRange(month);

  // For each head on the budget, compute sum(amountReceived) from cashbook details for that month/site/boq
  for (const headId of cashbookHeadIds) {
    const sumResult = await prisma.cashbookDetail.aggregate({
      _sum: { amountReceived: true },
      where: {
        cashbookHeadId: headId,
        amountReceived: { not: null },
        cashbook: {
          siteId: siteId ?? null,
          boqId: boqId ?? null,
          createdAt: { gte: start, lt: end },
        },
      },
    });

    const received = Number(sumResult._sum.amountReceived ?? 0);

    // Update the matching budget item (if exists). If not exists, skip silently.
    await prisma.cashbookBudgetItem.updateMany({
      where: { budgetId: budget.id, cashbookHeadId: headId },
      data: { receivedAmount: received },
    });
  }

  // Recompute totalReceivedAmount as sum of all items' receivedAmount
  const itemsAgg = await prisma.cashbookBudgetItem.aggregate({
    _sum: { receivedAmount: true },
    where: { budgetId: budget.id },
  });

  const totalReceived = Number(itemsAgg._sum.receivedAmount ?? 0);

  await prisma.cashbookBudget.update({
    where: { id: budget.id },
    data: { totalReceivedAmount: totalReceived },
  });
}

// Recompute a whole budget identified by (siteId, boqId, month) across ALL its items
export async function recomputeBudgetByKey(params: {
  siteId: number | null;
  boqId: number | null;
  month: string; // MM-YYYY
}) {
  const { siteId, boqId, month } = params;
  if (!month) return;

  const budget = await prisma.cashbookBudget.findFirst({
    where: {
      month,
      siteId: siteId ?? null,
      boqId: boqId ?? null,
    },
    select: { id: true },
  });

  if (!budget) return;

  // Fetch all budget items' headIds
  const items = await prisma.cashbookBudgetItem.findMany({
    where: { budgetId: budget.id },
    select: { cashbookHeadId: true },
  });
  const headIds = Array.from(new Set(items.map((i) => i.cashbookHeadId)));
  if (headIds.length === 0) {
    await prisma.cashbookBudget.update({
      where: { id: budget.id },
      data: { totalReceivedAmount: 0 },
    });
    return;
  }

  // Reuse the context recompute which updates items and total
  await recomputeBudgetForContext({
    siteId,
    boqId,
    month,
    cashbookHeadIds: headIds,
  });
}

export async function recomputeBudgetForCashbook(cashbookId: number) {
  const cashbook = await prisma.cashbook.findUnique({
    where: { id: cashbookId },
    select: {
      id: true,
      siteId: true,
      boqId: true,
      createdAt: true,
    },
  });

  if (!cashbook) return;

  const month = getMonthStringFromDate(new Date(cashbook.createdAt));
  await recomputeBudgetByKey({
    siteId: cashbook.siteId ?? null,
    boqId: cashbook.boqId ?? null,
    month,
  });
}
