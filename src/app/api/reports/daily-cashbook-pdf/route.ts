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

  // Fetch vouchers in range
  const vouchers = await prisma.cashbook.findMany({
    where: {
      voucherDate: { gte: fromDate, lt: toDateExclusive },
      siteId: Number(siteId),
      boqId: Number(boqId),
    },
    select: { id: true, voucherDate: true },
    orderBy: { voucherDate: "asc" },
  });
  const voucherIds = vouchers.map((v) => v.id);

  // Group details by day
  let rows: { date: string; received: number; paid: number }[] = [];
  if (voucherIds.length) {
    // Get sums per voucher first
    const details = await prisma.cashbookDetail.groupBy({
      by: ["cashbookId"],
      where: { cashbookId: { in: voucherIds } },
      _sum: { amountReceived: true, amountPaid: true },
    });
    const sumsByVoucher = new Map<number, { received: number; paid: number }>();
    for (const d of details) {
      sumsByVoucher.set(d.cashbookId, {
        received: Number(d._sum.amountReceived || 0),
        paid: Number(d._sum.amountPaid || 0),
      });
    }
    // Aggregate per day
    const map = new Map<string, { received: number; paid: number }>();
    for (const v of vouchers) {
      const key = new Date(v.voucherDate).toLocaleDateString("en-GB");
      const sums = sumsByVoucher.get(v.id) || { received: 0, paid: 0 };
      const cur = map.get(key) || { received: 0, paid: 0 };
      cur.received += sums.received;
      cur.paid += sums.paid;
      map.set(key, cur);
    }
    rows = Array.from(map.entries())
      .sort((a, b) => {
        const [da, db] = [a[0].split("/"), b[0].split("/")];
        const ta = new Date(
          Number(da[2]),
          Number(da[1]) - 1,
          Number(da[0])
        ).getTime();
        const tb = new Date(
          Number(db[2]),
          Number(db[1]) - 1,
          Number(db[0])
        ).getTime();
        return ta - tb;
      })
      .map(([date, s]) => ({ date, received: s.received, paid: s.paid }));
  }

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
  const fromText = `From Date: ${new Date(fromDate).toLocaleDateString(
    "en-GB"
  )}`;
  const toText = `To Date: ${new Date(
    new Date(toDateExclusive).getTime() - 1
  ).toLocaleDateString("en-GB")}`;
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

  // Build table
  let totalReceived = 0;
  let totalPaid = 0;
  const body = rows.map((r) => {
    totalReceived += r.received;
    totalPaid += r.paid;
    return [r.date, `Rs.${r.received.toFixed(2)}`, `Rs.${r.paid.toFixed(2)}`];
  });

  autoTable(doc, {
    startY: y + 10,
    head: [["Date", "Received", "Expense"]],
    body,
    foot: [
      [
        {
          content: "Total",
          colSpan: 1,
          styles: { fontStyle: "bold", halign: "right" },
        },
        `Rs.${totalReceived.toFixed(2)}`,
        `Rs.${totalPaid.toFixed(2)}`,
      ],
    ],
    showFoot: "lastPage",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [200, 200, 200], textColor: 0, halign: "center" },
    theme: "grid",
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
    },
  });

  // Footer with date/time and pages
  const format12h = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm2 = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy2 = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hh = String(hours).padStart(2, "0");
    return `${dd}/${mm2}/${yyyy2} ${hh}:${minutes} ${ampm}`;
  };
  const nowStr = format12h(new Date());
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
