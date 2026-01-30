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

function startOfDayUtc(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUtc(d: Date, days: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function parseHeadIds(raw: string | null) {
  if (!raw) return [] as number[];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
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

  const cashbookHeadIds = parseHeadIds(cashbookHeadIdsStr);
  const fromDate = startOfDayUtc(fromDateStr);
  const toDateExclusive = addDaysUtc(startOfDayUtc(toDateStr), 1);

  const siteMeta = await prisma.site.findUnique({
    where: { id: Number(siteId) },
    select: { site: true },
  });
  const boqMeta = await prisma.boq.findUnique({
    where: { id: Number(boqId) },
    select: { boqNo: true, workName: true },
  });

  const details = await prisma.cashbookDetail.findMany({
    where: {
      ...(cashbookHeadIds.length > 0 ? { cashbookHeadId: { in: cashbookHeadIds } } : {}),
      cashbook: {
        voucherDate: { gte: fromDate, lt: toDateExclusive },
        siteId: Number(siteId),
        boqId: Number(boqId),
      },
    },
    orderBy: [
      { cashbook: { voucherDate: "asc" } },
      { cashbook: { id: "asc" } },
      { id: "asc" },
    ],
    select: {
      description: true,
      openingBalance: true,
      closingBalance: true,
      amountReceived: true,
      amountPaid: true,
      documentUrl: true,
      cashbookHead: { select: { cashbookHeadName: true } },
      cashbook: { select: { voucherDate: true, voucherNo: true } },
    },
  });

  const rows: any[][] = [];
  for (const det of details) {
    const voucherDate = det.cashbook.voucherDate
      ? formatDdMmYyyy(new Date(det.cashbook.voucherDate))
      : "-";
    const voucherNo = det.cashbook.voucherNo || "-";
    const head = det.cashbookHead?.cashbookHeadName || "-";
    const desc = det.description || "";
    const supportingBill = det.documentUrl ? "Yes" : "No";
    const ob = Number(det.openingBalance ?? 0);
    const ar = Number(det.amountReceived ?? 0);
    const ap = Number(det.amountPaid ?? 0);
    const cb = Number(det.closingBalance ?? ob + ar - ap);
    rows.push([voucherDate, head, desc, supportingBill, voucherNo, ob, ar, ap, cb]);
  }

  const wsData: any[][] = [];
  wsData.push(["Cashbook Details"]);
  wsData.push([`From Date: ${formatDdMmYyyy(fromDate)}`]);
  wsData.push([`To Date: ${formatDdMmYyyy(new Date(toDateStr))}`]);
  wsData.push([`Site: ${siteMeta?.site ?? "-"}`]);
  wsData.push([
    `BOQ: ${boqMeta?.boqNo ?? "-"}${boqMeta?.workName ? " - " + boqMeta.workName : ""}`,
  ]);
  wsData.push([]);
  wsData.push([
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

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 50 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cashbook Details");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename=cashbook-details-${fromDateStr}-to-${toDateStr}-S${siteId}-B${boqId}.xlsx`,
      "Cache-Control": "no-store",
    },
  });
}
