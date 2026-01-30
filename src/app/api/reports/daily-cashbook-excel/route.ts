import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function formatDdMmYyyy(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDdMmYyyyTime(d: Date) {
  const ddmm = formatDdMmYyyy(d);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  return `${ddmm} ${hh}:${minutes}:${seconds}${ampm}`;
}

function startOfDayUtc(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUtc(d: Date, days: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_CASHBOOKS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const fromDateStr = sp.get("fromDate");
  const toDateStr = sp.get("toDate");
  const siteId = sp.get("siteId");
  const boqId = sp.get("boqId");
  const cashbookHeadIdsStr = sp.get("cashbookHeadIds");

  if (!fromDateStr || Number.isNaN(Date.parse(fromDateStr))) {
    return NextResponse.json(
      { error: "fromDate is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (!toDateStr || Number.isNaN(Date.parse(toDateStr))) {
    return NextResponse.json(
      { error: "toDate is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (!siteId || Number.isNaN(Number(siteId))) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }
  if (!boqId || Number.isNaN(Number(boqId))) {
    return NextResponse.json({ error: "boqId is required" }, { status: 400 });
  }

  const cashbookHeadIds = (cashbookHeadIdsStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);

  const fromDate = startOfDayUtc(fromDateStr);
  const toDateExclusive = addDaysUtc(startOfDayUtc(toDateStr), 1);

  // Fetch meta for site/boq to display names/codes
  const siteMeta = await prisma.site.findUnique({
    where: { id: Number(siteId) },
    select: { site: true },
  });
  const boqMeta = await prisma.boq.findUnique({
    where: { id: Number(boqId) },
    select: { boqNo: true, workName: true },
  });

  // Fetch vouchers with details in range
  const cashbooks = await prisma.cashbook.findMany({
    where: {
      voucherDate: { gte: fromDate, lt: toDateExclusive },
      siteId: Number(siteId),
      boqId: Number(boqId),
    },
    select: {
      id: true,
      voucherNo: true,
      voucherDate: true,
      createdAt: true,
      cashbookDetails: {
        where:
          cashbookHeadIds.length > 0
            ? {
                cashbookHeadId: { in: cashbookHeadIds },
              }
            : undefined,
        select: {
          cashbookHead: { select: { cashbookHeadName: true } },
          description: true,
          openingBalance: true,
          closingBalance: true,
          amountReceived: true,
          amountPaid: true,
          documentUrl: true,
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { voucherDate: "asc" },
  });

  // Flatten details into rows
  const rows: any[][] = [];
  let runningClosing: number | null = null;
  let totalReceived = 0;
  let totalPaid = 0;
  for (const cb of cashbooks) {
    const createdAt = new Date(cb.createdAt || cb.voucherDate || fromDate);
    const createdAtStr = formatDdMmYyyy(createdAt);
    const voucherDateStr = cb.voucherDate ? formatDdMmYyyy(new Date(cb.voucherDate)) : "-";
    const voucherNo = cb.voucherNo || "-";
    for (const det of cb.cashbookDetails || []) {
      const head = det.cashbookHead?.cashbookHeadName || "-";
      const desc = det.description || "";
      const supportingBill = det.documentUrl ? "Yes" : "No";
      const ob = Number(det.openingBalance ?? 0);
      const ar = Number(det.amountReceived ?? 0);
      const ap = Number(det.amountPaid ?? 0);
      const cbalance = Number(det.closingBalance ?? ob + ar - ap);
      runningClosing = cbalance;
      totalReceived += ar;
      totalPaid += ap;
      rows.push([
        createdAtStr,
        voucherDateStr,
        head,
        desc,
        supportingBill,
        voucherNo,
        ob,
        ar,
        ap,
        cbalance,
      ]);
    }
  }

  const wsData: any[][] = [];
  wsData.push(["Daily Cashbook Report"]); // title
  wsData.push([`From Date: ${formatDdMmYyyy(fromDate)}`]);
  wsData.push([`To Date: ${formatDdMmYyyy(new Date(toDateStr!))}`]);
  wsData.push([`Site: ${siteMeta?.site ?? "-"}`]);
  wsData.push([
    `BOQ: ${boqMeta?.boqNo ?? "-"}${boqMeta?.workName ? " - " + boqMeta.workName : ""}`,
  ]);
  wsData.push([`Generated On: ${formatDdMmYyyyTime(new Date())}`]);
  wsData.push([]);
  wsData.push([
    "Created At",
    "Voucher Date",
    "Cashbook Head",
    "Description",
    "Supporting Bill",
    "Voucher Number",
    "Opening Balance",
    "Amount Received",
    "Amount Paid",
    "Closing Balance",
  ]);
  wsData.push(...rows);
  wsData.push([
    "Total",
    "",
    "",
    "",
    "",
    "",
    "",
    Number(totalReceived.toFixed(2)),
    Number(totalPaid.toFixed(2)),
    "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 14 }, // Created At
    { wch: 14 }, // Voucher Date
    { wch: 30 },
    { wch: 40 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  // Merge title across all columns and style
  if (!ws["!merges"]) ws["!merges"] = [];
  (ws["!merges"] as any).push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } });
  for (let c = 0; c <= 8; c++) {
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

  // Bold header row
  const headerRowIdx = 6; // zero-based
  for (let c = 0; c <= 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const cell = (ws as any)[cellRef];
    if (cell) {
      cell.s = {
        ...(cell.s || {}),
        font: { ...(cell.s?.font || {}), bold: true },
      } as any;
    }
  }

  // Bold totals row (last row)
  const totalRowIdx = wsData.length - 1;
  for (let c = 0; c <= 9; c++) {
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
  XLSX.utils.book_append_sheet(wb, ws, "Daily Cashbook");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename=daily-cashbook-${fromDateStr}-to-${toDateStr}-S${siteId}-B${boqId}.xlsx`,
      "Cache-Control": "no-store",
    },
  });
}
