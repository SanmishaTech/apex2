import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function fmtRs(n: number) {
  return Number(n || 0).toFixed(2);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB");
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_CASHBOOK_BUDGETS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const month = sp.get("month"); // MM-YYYY
  const siteId = sp.get("siteId");
  const boqId = sp.get("boqId");

  if (!month || !/^\d{2}-\d{4}$/.test(month)) {
    return NextResponse.json({ error: "Missing or invalid month (MM-YYYY)" }, { status: 400 });
  }
  if (!siteId || Number.isNaN(Number(siteId))) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }
  if (!boqId || Number.isNaN(Number(boqId))) {
    return NextResponse.json({ error: "boqId is required" }, { status: 400 });
  }

  const budget = await prisma.cashbookBudget.findFirst({
    where: { month, siteId: Number(siteId), boqId: Number(boqId) },
    include: {
      site: {
        select: {
          site: true,
          company: { select: { companyName: true, shortName: true } },
        },
      },
      boq: { select: { boqNo: true, workName: true } },
      budgetItems: {
        include: { cashbookHead: { select: { cashbookHeadName: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  const [mm, yyyy] = month.split("-");
  const startDate = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, 1));
  const endDate = new Date(Date.UTC(Number(yyyy), Number(mm), 1)); // exclusive

  const vouchers = await prisma.cashbook.findMany({
    where: {
      voucherDate: { gte: startDate, lt: endDate },
      siteId: Number(siteId),
      boqId: Number(boqId),
    },
    select: { id: true },
  });
  const voucherIds = vouchers.map((v) => v.id);

  let receivedPaidByHead: Record<number, { received: number; paid: number }> = {};
  if (voucherIds.length) {
    const grouped = await prisma.cashbookDetail.groupBy({
      by: ["cashbookHeadId"],
      where: { cashbookId: { in: voucherIds } },
      _sum: { amountReceived: true, amountPaid: true },
    });
    receivedPaidByHead = Object.fromEntries(
      grouped.map((g) => [
        g.cashbookHeadId,
        {
          received: Number(g._sum.amountReceived || 0),
          paid: Number(g._sum.amountPaid || 0),
        },
      ])
    );
  }

  // Sum budget amounts by head only if budget is accepted
  const budgetByHead = new Map<number, number>();
  const isBudgetAccepted = Boolean(budget?.acceptedBy && budget?.acceptedDatetime);
  if (isBudgetAccepted && budget?.budgetItems?.length) {
    for (const it of budget.budgetItems) {
      const headId = (it as any).cashbookHeadId as number;
      const amt = Number(it.amount || 0);
      budgetByHead.set(headId, (budgetByHead.get(headId) || 0) + amt);
    }
  }

  // Gather head names from items and any heads present only in vouchers
  const allHeadIds = new Set<number>([
    ...Array.from(budgetByHead.keys()),
    ...Object.keys(receivedPaidByHead).map((k) => Number(k)),
  ]);

  const heads = await prisma.cashbookHead.findMany({
    where: { id: { in: Array.from(allHeadIds) } },
    select: { id: true, cashbookHeadName: true },
  });
  const headNameById = new Map(heads.map((h) => [h.id, h.cashbookHeadName]));

  // Description per head from first budget item (only when budget accepted)
  const descriptionByHead = new Map<number, string>();
  if (isBudgetAccepted && budget?.budgetItems?.length) {
    for (const it of budget.budgetItems) {
      const headId = (it as any).cashbookHeadId as number;
      if (!descriptionByHead.has(headId)) {
        const desc = (it as any).description || "";
        if (desc) descriptionByHead.set(headId, String(desc));
      }
    }
  }

  const siteMeta =
    budget?.site ||
    (await prisma.site.findUnique({
      where: { id: Number(siteId) },
      select: {
        site: true,
        company: { select: { companyName: true, shortName: true } },
      },
    }));

  const boqMeta =
    budget?.boq ||
    (await prisma.boq.findUnique({
      where: { id: Number(boqId) },
      select: { boqNo: true, workName: true },
    }));

  const sortedHeadIds = Array.from(allHeadIds).sort((a, b) => {
    const an = (headNameById.get(a) || "").toLowerCase();
    const bn = (headNameById.get(b) || "").toLowerCase();
    return an.localeCompare(bn);
  });

  let totalBudget = 0;
  let totalReceived = 0;
  let totalPaid = 0;

  const tableRows = sortedHeadIds.map((headId) => {
    const name = String(headNameById.get(headId) || `Head ${headId}`);
    const budgetAmt = Number(budgetByHead.get(headId) || 0);
    const rp = receivedPaidByHead[headId] || { received: 0, paid: 0 };
    totalBudget += budgetAmt;
    totalReceived += rp.received;
    totalPaid += rp.paid;
    const desc = descriptionByHead.get(headId) || "";
    return [name, desc, Number(fmtRs(budgetAmt)), Number(fmtRs(rp.received)), Number(fmtRs(rp.paid))];
  });

  const wsData: any[][] = [];
  wsData.push(["Cashbook Budget Report"]); // row 0
  wsData.push([`Month: ${month}`]); // row 1
  wsData.push([`Site: ${siteMeta?.site ?? "-"}`]); // row 2
  wsData.push([`BOQ: ${boqMeta?.boqNo ?? "-"}${boqMeta?.workName ? " - " + boqMeta.workName : ""}`]); // row 3
  wsData.push([`Period: ${formatDate(startDate)} to ${formatDate(new Date(endDate.getTime() - 1))}`]); // row 4
  wsData.push([`Generated On: ${new Date().toLocaleString("en-IN", { hour12: true })}`]); // row 5
  wsData.push([]); // row 6 (blank)
  wsData.push(["Cashbook Head", "Description", "Budget Amount", "Received", "Expense"]); // row 7 header
  wsData.push(...tableRows);
  wsData.push(["Total", "", Number(fmtRs(totalBudget)), Number(fmtRs(totalReceived)), Number(fmtRs(totalPaid))]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 40 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  // Style: center & bold main heading, bold header row and totals row
  // Merge A1:E1 so heading is centered across table columns (rows/cols are 0-based)
  if (!ws["!merges"]) ws["!merges"] = [];
  (ws["!merges"] as any).push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
  // Apply bold+center to all cells in merged heading row (A1-E1)
  for (let c = 0; c <= 4; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    const cell = (ws as any)[cellRef];
    if (cell) {
      cell.s = {
        ...(cell.s || {}),
        font: { ...(cell.s?.font || {}), bold: true },
        alignment: { horizontal: "center", vertical: "center" },
      } as any;
    }
  }

  // Header row (column headings) is at row index 7 (0-based), i.e. Excel row 8
  const headerRowIdx = 7;
  const headerCols = 5;
  for (let c = 0; c < headerCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const cell = (ws as any)[cellRef];
    if (cell) {
      cell.s = {
        ...(cell.s || {}),
        font: { ...(cell.s?.font || {}), bold: true },
      } as any;
    }
  }

  // Totals row is the last row in wsData
  const totalRowIdx = wsData.length - 1;
  for (let c = 0; c < headerCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    const cell = (ws as any)[cellRef];
    if (cell) {
      cell.s = {
        ...(cell.s || {}),
        font: { ...(cell.s?.font || {}), bold: true },
      } as any;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cashbook Budget");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename=cashbook-budget-${month}-S${siteId}-B${boqId}.xlsx`,
      "Cache-Control": "no-store",
    },
  });
}
