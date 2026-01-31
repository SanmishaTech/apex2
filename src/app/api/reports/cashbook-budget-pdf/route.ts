import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function makePdfFromLines(lines: string[]) {
  const enc = new TextEncoder();
  const objects: string[] = [];
  const header = "%PDF-1.4\n";
  // 1: Catalog, 2: Pages, 3: Page, 4: Contents, 5: Font
  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  objects[2] = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  objects[5] =
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const fontSize = 9;
  const left = 40;
  let y = 800 - 40;
  const leading = 12;
  const contentParts: string[] = [];
  contentParts.push("BT\n/F1 " + fontSize + " Tf\n");
  contentParts.push(`1 0 0 1 ${left} ${y} Tm\n`);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].replace(/\(/g, "[").replace(/\)/g, "]");
    if (i > 0) contentParts.push(`0 -${leading} Td\n`);
    contentParts.push(`(${t}) Tj\n`);
  }
  contentParts.push("ET\n");
  const contentStream = contentParts.join("");
  const contentLen = enc.encode(contentStream).length;
  objects[4] = `4 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`;
  objects[3] =
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";

  const parts: string[] = [header];
  const offsets: number[] = [];
  let offset = header.length;
  for (let i = 1; i <= 5; i++) {
    offsets[i] = offset;
    const obj = objects[i];
    parts.push(obj);
    offset += obj.length;
  }
  const xrefStart = offset;
  const xref: string[] = [];
  xref.push("xref\n");
  xref.push("0 6\n");
  xref.push("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    xref.push(("0000000000" + offsets[i]).slice(-10) + " 00000 n \n");
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(xref.join(""));
  parts.push(trailer);
  return enc.encode(parts.join(""));
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [
    PERMISSIONS.GENERATE_CASHBOOK_BUDGET_REPORT,
  ]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const month = sp.get("month"); // MM-YYYY
  const siteId = sp.get("siteId");
  const boqId = sp.get("boqId");

  if (!month || !/^\d{2}-\d{4}$/.test(month)) {
    return NextResponse.json(
      { error: "Missing or invalid month (MM-YYYY)" },
      { status: 400 }
    );
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
  // If budget is missing, still proceed to generate report (use vouchers-only data and fetch meta)
  // Compute month date range and aggregate cashbook receipts/payments per head
  const [mm, yyyy] = month.split("-");
  const startDate = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, 1));
  const endDate = new Date(Date.UTC(Number(yyyy), Number(mm), 1)); // exclusive
  const endDateInclusive = new Date(Date.UTC(Number(yyyy), Number(mm), 0));

  const vouchers = await prisma.cashbook.findMany({
    where: {
      voucherDate: { gte: startDate, lt: endDate },
      siteId: Number(siteId),
      boqId: Number(boqId),
    },
    select: { id: true },
  });
  const voucherIds = vouchers.map((v) => v.id);

  let receivedPaidByHead: Record<number, { received: number; paid: number }> =
    {};
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

  // Sum budget amounts by head (multiple items per head allowed) - only if budget is accepted
  const budgetByHead = new Map<number, number>();
  const isBudgetAccepted = Boolean(
    budget?.acceptedBy && budget?.acceptedDatetime
  );
  if (isBudgetAccepted && budget?.budgetItems?.length) {
    for (const it of budget.budgetItems) {
      const headId = it.cashbookHeadId || (it as any).cashbookHeadId; // ensure id available
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

  // Build PDF via jsPDF to render bordered header and table layout
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const fmtRs = (n: number) => `Rs.${Number(n || 0).toFixed(2)}`;

  // Header box
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, 186, 18); // x, y, w, h
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  // Fetch site/boq meta when budget is absent for header block
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

  const companyLeft =
    siteMeta?.company?.shortName || siteMeta?.company?.companyName || "";
  // Removed left-side company text per requirements
  doc.setFontSize(12);
  // Keep DCTPL centered within header box
  doc.text("DCTPL", 105, 20, { align: "center" });

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  // Place title just below DCTPL inside the header border (border y:12..30)
  doc.text("Report : Cashbook Budget Report", 105, 27, { align: "center" });

  // Filters block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fromText = `From Date: ${startDate.toLocaleDateString("en-GB")}`;
  const toText = `To Date: ${endDateInclusive.toLocaleDateString("en-GB")}`;
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

  // Prepare rows (include description using first non-empty description for the head)
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

  let totalBudget = 0;
  let totalReceived = 0;
  let totalPaid = 0;
  const sortedHeadIds = Array.from(allHeadIds).sort((a, b) => {
    const an = (headNameById.get(a) || "").toLowerCase();
    const bn = (headNameById.get(b) || "").toLowerCase();
    return an.localeCompare(bn);
  });
  const bodyRows = sortedHeadIds.map((headId) => {
    const name = String(headNameById.get(headId) || `Head ${headId}`);
    const budgetAmt = Number(budgetByHead.get(headId) || 0);
    const rp = receivedPaidByHead[headId] || { received: 0, paid: 0 };
    totalBudget += budgetAmt;
    totalReceived += rp.received;
    totalPaid += rp.paid;
    const desc = descriptionByHead.get(headId) || "";
    return [name, desc, fmtRs(budgetAmt), fmtRs(rp.received), fmtRs(rp.paid)];
  });

  // Table
  autoTable(doc, {
    startY: y + 10,
    head: [
      ["Cashbook Head", "Description", "Budget Amount", "Received", "Expense"],
    ],
    body: bodyRows,
    foot: [
      [
        {
          content: "Total",
          colSpan: 2,
          styles: { fontStyle: "bold", halign: "right" },
        },
        fmtRs(totalBudget),
        fmtRs(totalReceived),
        fmtRs(totalPaid),
      ],
    ],
    showFoot: "lastPage",
    styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.2 },
    headStyles: { fillColor: false, textColor: 0, halign: "center" },
    footStyles: { fontSize: 9, cellPadding: 2 },
    theme: "grid",
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    didDrawPage(data) {
      // Optional: could redraw header box per page if multi-page
    },
  });

  // Footer: date/time (dd/mm/yyyy hh:mm AM/PM) and page X/Y on each page
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
    // Left: date/time
    doc.text(nowStr, 12, 290);
    // Right: page X/Y
    doc.text(`Page ${i}/${pageCount}`, 198, 290, { align: "right" });
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=cashbook-budget-${month}-S${siteId}-B${boqId}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
