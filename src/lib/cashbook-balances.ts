import type { PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function asDecimalString2(n: number | null) {
  if (n === null) return null;
  return round2(n).toFixed(2) as any;
}

function boqFilter(boqId: number | null | undefined) {
  if (boqId === undefined) return {};
  return { boqId };
}

export async function recomputeCashbookBalances(params: {
  tx: Tx;
  siteId: number | null | undefined;
  boqId: number | null | undefined;
  cashbookHeadIds: number[];
  fromVoucherDate: Date;
}) {
  const { tx, siteId, boqId, cashbookHeadIds } = params;
  if (!siteId || !Number.isFinite(siteId)) return;

  const headIds = Array.from(
    new Set(cashbookHeadIds.filter((id) => Number.isFinite(id) && id > 0))
  );
  if (headIds.length === 0) return;

  const fromDay = startOfDay(params.fromVoucherDate);

  for (const cashbookHeadId of headIds) {
    const seed = await tx.cashbookDetail.findFirst({
      where: {
        cashbookHeadId,
        cashbook: {
          siteId,
          ...boqFilter(boqId),
          voucherDate: { lt: fromDay },
        },
      },
      orderBy: [
        { cashbook: { voucherDate: "desc" } },
        { cashbook: { id: "desc" } },
        { id: "desc" },
      ],
      select: { closingBalance: true },
    });

    let running = Number(seed?.closingBalance ?? 0);

    const rows = await tx.cashbookDetail.findMany({
      where: {
        cashbookHeadId,
        cashbook: {
          siteId,
          ...boqFilter(boqId),
          voucherDate: { gte: fromDay },
        },
      },
      orderBy: [
        { cashbook: { voucherDate: "asc" } },
        { cashbook: { id: "asc" } },
        { id: "asc" },
      ],
      select: {
        id: true,
        openingBalance: true,
        closingBalance: true,
        amountReceived: true,
        amountPaid: true,
      },
    });

    for (const row of rows) {
      const received = Number(row.amountReceived ?? 0);
      const paid = Number(row.amountPaid ?? 0);

      const opening = round2(running);
      const closing = round2(opening + received - paid);
      running = closing;

      const existingOpening =
        row.openingBalance !== null && row.openingBalance !== undefined
          ? round2(Number(row.openingBalance))
          : null;
      const existingClosing =
        row.closingBalance !== null && row.closingBalance !== undefined
          ? round2(Number(row.closingBalance))
          : null;

      if (existingOpening !== opening || existingClosing !== closing) {
        await tx.cashbookDetail.update({
          where: { id: row.id },
          data: {
            openingBalance: asDecimalString2(opening),
            closingBalance: asDecimalString2(closing),
          } as any,
          select: { id: true },
        });
      }
    }
  }
}
