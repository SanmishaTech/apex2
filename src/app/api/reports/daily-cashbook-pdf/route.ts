import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_CASHBOOKS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const fromDateStr = sp.get("fromDate");
  const toDateStr = sp.get("toDate");
  const siteId = sp.get("siteId");
  const boqId = sp.get("boqId");

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

  const fromDate = new Date(fromDateStr);
  const toDateExclusive = new Date(
    new Date(toDateStr).getTime() + 24 * 60 * 60 * 1000
  );

  const formatDdMmYyyy = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
  const formatDdMmYyyyTime = (d: Date) => {
    const ddmm = formatDdMmYyyy(d);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hh = String(hours).padStart(2, "0");
    return `${ddmm} ${hh}:${minutes}:${seconds}${ampm}`;
  };

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

  // Fetch header meta
  const siteMeta = await prisma.site.findUnique({
    where: { id: Number(siteId) },
    select: {
      site: true,
      company: { select: { companyName: true, shortName: true } },
    },
  });
  const boqMeta = await prisma.boq.findUnique({
    where: { id: Number(boqId) },
    select: { boqNo: true, workName: true },
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header box and titles
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, 186, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DCTPL", 105, 20, { align: "center" });
  doc.setFontSize(14);
  doc.text("Report : Daily Cashbook Report", 105, 27, { align: "center" });

  // Filters
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fromText = `From Date: ${formatDdMmYyyy(fromDate)}`;
  const toText = `To Date: ${formatDdMmYyyy(new Date(toDateStr))}`;
  const siteText = `Site: ${siteMeta?.site ?? "-"}`;
  const boqText = `Boq No: ${boqMeta?.boqNo ?? "-"}`;
  let y = 48;
  doc.text(fromText, 16, y);
  y += 5;
  doc.text(toText, 16, y);
  y += 5;
  doc.text(siteText, 16, y);
  y += 5;
  doc.text(boqText, 16, y);

  // Build detail rows
  const body: any[][] = [];
  let totalReceived = 0;
  let totalPaid = 0;
  for (const cb of cashbooks) {
    const createdAt = new Date(cb.createdAt || cb.voucherDate || fromDate);
    const createdAtStr = formatDdMmYyyy(createdAt);
    const voucherDateStr = cb.voucherDate
      ? formatDdMmYyyy(new Date(cb.voucherDate))
      : "-";
    const voucherNo = cb.voucherNo || "-";
    for (const det of cb.cashbookDetails || []) {
      const head = det.cashbookHead?.cashbookHeadName || "-";
      const desc = det.description || "";
      const supportingBill = det.documentUrl ? "Yes" : "No";
      const ob = Number(det.openingBalance ?? 0);
      const ar = Number(det.amountReceived ?? 0);
      const ap = Number(det.amountPaid ?? 0);
      const cbalance = Number(det.closingBalance ?? ob + ar - ap);
      totalReceived += ar;
      totalPaid += ap;
      body.push([
        createdAtStr,
        voucherDateStr,
        head,
        desc,
        supportingBill,
        voucherNo,
        ob.toFixed(2),
        ar.toFixed(2),
        ap.toFixed(2),
        cbalance.toFixed(2),
      ]);
    }
  }

  autoTable(doc, {
    startY: y + 10,
    head: [
      [
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
      ],
    ],
    body,
    foot: [
      [
        { content: "Total", colSpan: 7, styles: { fontStyle: "bold", halign: "right" } },
        totalReceived.toFixed(2),
        totalPaid.toFixed(2),
        "",
      ],
    ],
    showFoot: "lastPage",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: 0, halign: "center" },
    theme: "grid",
    columnStyles: {
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });

  // Footer with date/time and pages
  const nowStr = formatDdMmYyyyTime(new Date());
  const pageCount = (doc as any).getNumberOfPages();
  doc.setFontSize(9);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(nowStr, 12, 290);
    doc.text(`Page ${i}/${pageCount}`, 198, 290, { align: "right" });
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=daily-cashbook-${fromDateStr}-to-${toDateStr}-S${siteId}-B${boqId}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
