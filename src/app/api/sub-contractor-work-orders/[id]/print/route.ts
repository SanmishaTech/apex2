import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { BadRequest } from "@/lib/api-response";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function formatDateSafe(value?: Date | string | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy");
}

function formatCurrency(value: unknown) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: unknown, fractionDigits = 2) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

// Load logo from site's company (no fallback)
async function loadLogoDataUrl(logoPath?: string | null): Promise<{
  dataUrl: string;
  format: "PNG" | "JPEG";
} | null> {
  if (!logoPath) {
    return null;
  }

  try {
    const p = path.join(process.cwd(), logoPath);
    const buf = await fs.readFile(p);
    const isPng = logoPath.toLowerCase().endsWith(".png");
    const fmt = isPng
      ? "PNG"
      : logoPath.toLowerCase().endsWith(".jpg") ||
        logoPath.toLowerCase().endsWith(".jpeg")
      ? "JPEG"
      : "PNG";
    const dataUrl = `data:image/${isPng ? "png" : "jpeg"};base64,${buf.toString("base64")}`;
    return { dataUrl, format: fmt as "PNG" | "JPEG" };
  } catch {
    return null;
  }
}

function getWatermarkText(status?: string | null, isApproved2?: boolean) {
  const s = String(status || "DRAFT").toUpperCase();
  if (s === "SUSPENDED") return "SUSPENDED";
  if (s === "APPROVED_LEVEL_2" || isApproved2) return null;
  return "DRAFT";
}

function applyWatermark(doc: jsPDF, text: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const centerX = w / 2;
    const centerY = h / 2;
    doc.saveGraphicsState();
    doc.setTextColor(110);
    if (typeof (doc as any).setGState === "function" && (doc as any).GState) {
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.22 }));
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.text(text, centerX, centerY, { align: "center", baseline: "middle", angle: 45 } as any);
    doc.restoreGraphicsState();
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.PRINT_SUB_CONTRACTOR_WORK_ORDERS]);
  if (auth.ok === false) return auth.response;

  const idParam = (await context.params).id;
  const id = Number.parseInt(idParam, 10);
  if (Number.isNaN(id)) return BadRequest("Invalid work order ID");

  const swo = await prisma.subContractorWorkOrder.findUnique({
    where: { id },
    select: {
      id: true,
      workOrderNo: true,
      workOrderDate: true,
      deliveryDate: true,
      quotationNo: true,
      quotationDate: true,
      note: true,
      terms: true,
      paymentTermsInDays: true,
      totalAmount: true,
      totalCgst: true,
      totalSgst: true,
      totalIgst: true,
      amountInWords: true,
      status: true,
      isApproved2: true,
      subContractorWorkOrderfilePath: true,
      isApproved2Printed: true,
      site: {
        select: {
          site: true,
          shortName: true,
          addressLine1: true,
          addressLine2: true,
          city: { select: { city: true } },
          state: { select: { state: true } },
          pinCode: true,
          company: {
            select: {
              logoUrl: true,
            },
          },
        },
      },
      vendor: {
        select: {
          vendorName: true,
          contactPerson: true,
          mobile1: true,
          mobile2: true,
          email: true,
          addressLine1: true,
          addressLine2: true,
          city: { select: { city: true } },
          state: { select: { state: true } },
          pincode: true,
          gstNumber: true,
        },
      },
      billingAddress: {
        select: {
          companyName: true,
          addressLine1: true,
          addressLine2: true,
          city: { select: { city: true } },
          state: { select: { state: true } },
          pincode: true,
          gstNumber: true,
        },
      },
      deliveryAddress: {
        select: {
          addressLine1: true,
          addressLine2: true,
          city: { select: { city: true } },
          state: { select: { state: true } },
          pinCode: true,
        },
      },
      subContractorWorkOrderDetails: {
        select: {
          id: true,
          item: true,
          sacCode: true,
          qty: true,
          rate: true,
          amount: true,
          unit: { select: { unitName: true } },
          cgstAmt: true,
          sgstAmt: true,
          igstAmt: true,
        },
        orderBy: { id: "asc" },
      },
      subContractorWorkOrderPaymentTerms: {
        select: { paymentTerm: { select: { paymentTerm: true, description: true } } },
      },
    },
  });

  if (!swo) return NextResponse.json({ error: "Work order not found" }, { status: 404 });

  // If already approved2 and already printed, return saved file
  if ((swo as any).isApproved2 && (swo as any).isApproved2Printed && (swo as any).subContractorWorkOrderfilePath) {
    try {
      const fullPath = path.join(process.cwd(), (swo as any).subContractorWorkOrderfilePath);
      const fileContent = await fs.readFile(fullPath);
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="sub-contractor-work-order-${swo.workOrderNo || id}.pdf"`,
        },
      });
    } catch (e) {
      console.error("Failed to read saved work order PDF, regenerating...", e);
    }
  }

  // Helper functions for drawing
  function drawLines(
    doc: jsPDF,
    lines: { text: string; bold?: boolean }[],
    x: number,
    startY: number,
    lineHeight = 4
  ) {
    let currentY = startY;
    for (const line of lines) {
      if (!line.text) continue;
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      doc.text(line.text, x, currentY);
      currentY += lineHeight;
    }
    return currentY;
  }

  function measureWrappedLinesHeight(
    doc: jsPDF,
    lines: { text: string; bold?: boolean }[],
    maxWidth: number,
    lineHeight = 4
  ) {
    let total = 0;
    for (const line of lines) {
      if (!line.text) continue;
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      const wrapped = doc.splitTextToSize(line.text, maxWidth);
      total += (Array.isArray(wrapped) ? wrapped.length : 1) * lineHeight;
    }
    return total;
  }

  function drawWrappedLines(
    doc: jsPDF,
    lines: { text: string; bold?: boolean }[],
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight = 4
  ) {
    let currentY = startY;
    for (const line of lines) {
      if (!line.text) continue;
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      const wrapped = doc.splitTextToSize(line.text, maxWidth);
      const items = Array.isArray(wrapped) ? wrapped : [String(wrapped)];
      for (const w of items) {
        doc.text(w, x, currentY);
        currentY += lineHeight;
      }
    }
    return currentY;
  }

  function ensureSpace(
    doc: jsPDF,
    currentY: number,
    neededHeight: number,
    margin: number
  ) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      return margin;
    }
    return currentY;
  }

  function safeText(value?: string | null) {
    return value?.trim() ? value.trim() : "-";
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setTextColor(0);
  doc.setDrawColor(0);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;

  const headingFontSize = 10;
  const smallFontSize = 7;
  const tableFontSize = 7;
  const lineHeight = 3.0;

  // Place the company logo from site's company - top-right with larger sizing
  const logoHeight = 22;
  const logoWidth = 78;
  const logoY = margin;
  try {
    const companyLogoUrl = ((swo as any).site as any)?.company?.logoUrl;
    const logo = await loadLogoDataUrl(companyLogoUrl);
    if (logo) {
      const logoX = pageWidth - margin - logoWidth;
      doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoWidth, logoHeight);
    }
  } catch {}

  const headerY = logoY + logoHeight + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  doc.text("SUB CONTRACTOR WORK ORDER", pageWidth / 2, headerY, {
    align: "center",
  });

  const topBoxY = headerY + 3;
  const halfWidth = usableWidth / 2;
  const topBoxX = margin;

  doc.setFontSize(smallFontSize);
  const vendorPhone = [swo.vendor?.mobile1, swo.vendor?.mobile2]
    .filter(Boolean)
    .join(", ");
  const vendorLines = [
    { text: `To,`, bold: true },
    { text: `M/s ${safeText(swo.vendor?.vendorName)}`, bold: true },
    { text: safeText(swo.vendor?.addressLine1) },
    { text: safeText(swo.vendor?.addressLine2) },
    {
      text: [
        safeText(swo.vendor?.city?.city),
        safeText(swo.vendor?.state?.state),
        safeText(swo.vendor?.pincode),
      ]
        .filter((line) => line !== "-")
        .join(", "),
    },
    { text: `Contact Person : ${safeText(swo.vendor?.contactPerson)}` },
    { text: `Contact No : ${vendorPhone || "-"}` },
    { text: `Email Id : ${safeText(swo.vendor?.email)}` },
    { text: `GST No : ${safeText(swo.vendor?.gstNumber)}` },
  ];

  const billing = swo.billingAddress;
  const billingLines = [
    { text: "Billing Address", bold: true },
    { text: safeText(billing?.companyName), bold: true },
    { text: safeText(billing?.addressLine1) },
    { text: safeText(billing?.addressLine2) },
    { text: `State : ${safeText(billing?.state?.state)}` },
    {
      text: [
        safeText(billing?.city?.city),
        safeText(billing?.pincode),
      ]
        .filter((line) => line !== "-")
        .join(", "),
    },
    { text: `GST No : ${safeText(billing?.gstNumber)}` },
  ];

  const woHeaderLines = [
    { text: "WORK ORDER", bold: true },
    { text: `W O Number : ${safeText(swo.workOrderNo)}` },
    { text: `Work Order Date : ${formatDateSafe(swo.workOrderDate)}` },
    { text: `Quotation No : ${safeText(swo.quotationNo)}` },
    { text: `Quotation Date : ${formatDateSafe(swo.quotationDate)}` },
    { text: `Delivery Date : ${formatDateSafe(swo.deliveryDate)}` },
  ];

  const deliver = swo.deliveryAddress;
  const siteShortName = (swo.site as any)?.shortName || (swo.site as any)?.site || "";
  const deliverLines = [
    { text: "Delivery/Site Address :", bold: true },
    { text: safeText(siteShortName), bold: true },
    { text: safeText(deliver?.addressLine1) },
    { text: safeText(deliver?.addressLine2) },
    {
      text: [
        safeText(deliver?.city?.city),
        safeText(deliver?.state?.state),
        safeText(deliver?.pinCode),
      ]
        .filter((line) => line !== "-")
        .join(", "),
    },
  ];

  // Compute dynamic heights for top/bottom halves and draw the box & dividers
  const colTextWidth = halfWidth - 4;
  const vendorHeight = measureWrappedLinesHeight(
    doc,
    vendorLines,
    colTextWidth,
    lineHeight
  );
  const woHeaderHeight = measureWrappedLinesHeight(
    doc,
    woHeaderLines,
    colTextWidth,
    lineHeight
  );
  const topHalfHeight = Math.max(vendorHeight, woHeaderHeight) + 8;

  const billingHeight = measureWrappedLinesHeight(
    doc,
    billingLines,
    colTextWidth,
    lineHeight
  );
  const deliverHeight = measureWrappedLinesHeight(
    doc,
    deliverLines,
    colTextWidth,
    lineHeight
  );
  const bottomHalfHeight = Math.max(billingHeight, deliverHeight) + 8;

  const topBoxHeight = topHalfHeight + bottomHalfHeight;

  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(topBoxX, topBoxY, usableWidth, topBoxHeight);
  // vertical center divider
  doc.line(
    topBoxX + halfWidth,
    topBoxY,
    topBoxX + halfWidth,
    topBoxY + topBoxHeight
  );
  // horizontal divider at computed top-half height
  doc.line(
    topBoxX,
    topBoxY + topHalfHeight,
    topBoxX + halfWidth,
    topBoxY + topHalfHeight
  );
  doc.line(
    topBoxX + halfWidth,
    topBoxY + topHalfHeight,
    topBoxX + usableWidth,
    topBoxY + topHalfHeight
  );

  // Render wrapped text blocks within columns
  drawWrappedLines(
    doc,
    vendorLines,
    topBoxX + 2,
    topBoxY + 6,
    colTextWidth,
    lineHeight
  );
  drawWrappedLines(
    doc,
    woHeaderLines,
    topBoxX + halfWidth + 2,
    topBoxY + 6,
    colTextWidth,
    lineHeight
  );
  drawWrappedLines(
    doc,
    billingLines,
    topBoxX + 2,
    topBoxY + topHalfHeight + 6,
    colTextWidth,
    lineHeight
  );
  drawWrappedLines(
    doc,
    deliverLines,
    topBoxX + halfWidth + 2,
    topBoxY + topHalfHeight + 6,
    colTextWidth,
    lineHeight
  );

  const summaryGap = 3;
  const summaryYStart = topBoxY + topBoxHeight + summaryGap;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(smallFontSize);
  const summaryText =
    "Dear Sir/Madam: We are pleased to confirm our work order against your Quotation. You are requested to execute the following items as per terms and conditions attached.";
  const summarySpec = [{ text: summaryText }];
  const summaryHeight = measureWrappedLinesHeight(
    doc,
    summarySpec,
    usableWidth,
    lineHeight
  );
  drawWrappedLines(
    doc,
    summarySpec,
    margin,
    summaryYStart,
    usableWidth,
    lineHeight
  );

  const tableStartY = summaryYStart + summaryHeight + summaryGap;

  // Build item rows
  const details = swo.subContractorWorkOrderDetails || [];
  const itemRows = details.map((it: any, index: number) => {
    const qtyNum = Number(it.qty ?? 0);
    const rateNum = Number(it.rate ?? 0);
    const basicAmountNum = qtyNum * rateNum;
    return [
      (index + 1).toString(),
      [
        it.item || "-",
        it.description ? String(it.description) : "",
      ]
        .filter(Boolean)
        .join("\n"),
      it.sacCode ?? "-",
      it.unit?.unitName ?? "-",
      formatNumber(it.qty, 2),
      formatNumber(it.rate, 2),
      formatCurrency(basicAmountNum),
      // CGST
      formatNumber((Number(it.cgstAmt ?? 0) / (basicAmountNum || 1)) * 100, 2),
      formatCurrency(it.cgstAmt),
      // SGST
      formatNumber((Number(it.sgstAmt ?? 0) / (basicAmountNum || 1)) * 100, 2),
      formatCurrency(it.sgstAmt),
      // IGST
      formatNumber((Number(it.igstAmt ?? 0) / (basicAmountNum || 1)) * 100, 2),
      formatCurrency(it.igstAmt),
      formatCurrency(it.amount),
    ];
  });

  const totals = details.reduce(
    (acc: any, it: any) => {
      const qtyNum = Number(it.qty ?? 0);
      const rateNum = Number(it.rate ?? 0);
      const basicAmount = qtyNum * rateNum;
      const amount = Number(it.amount ?? 0);
      const cgst = Number(it.cgstAmt ?? 0);
      const sgst = Number(it.sgstAmt ?? 0);
      const igst = Number(it.igstAmt ?? 0);
      return {
        basicAmount: acc.basicAmount + basicAmount,
        amount: acc.amount + amount,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        igst: acc.igst + igst,
      };
    },
    { basicAmount: 0, amount: 0, cgst: 0, sgst: 0, igst: 0 }
  );

  const grandTotal = Number(swo.totalAmount ?? 0) || totals.amount;

  const amountWords = safeText(swo.amountInWords) || "Rupees Zero Only";
  const amountWordsDisplay = `Rupees : ${amountWords} Only`;

  const totalsRow: any[] = [
    "",
    "",
    "",
    "",
    "",
    { content: "Total", styles: { fontStyle: "bold", halign: "right" } },
    {
      content: formatCurrency(totals.basicAmount),
      styles: { fontStyle: "bold", halign: "right" },
    },
    "",
    {
      content: formatCurrency(totals.cgst),
      styles: { fontStyle: "bold", halign: "right" },
    },
    "",
    {
      content: formatCurrency(totals.sgst),
      styles: { fontStyle: "bold", halign: "right" },
    },
    "",
    {
      content: formatCurrency(totals.igst),
      styles: { fontStyle: "bold", halign: "right" },
    },
    {
      content: formatCurrency(totals.amount),
      styles: { fontStyle: "bold", halign: "right" },
    },
  ];

  const amountWordsRow: any[] = [
    {
      content: amountWordsDisplay,
      colSpan: 13,
      styles: { fontStyle: "bold", halign: "left" },
    },
    {
      content: formatCurrency(grandTotal),
      styles: { fontStyle: "bold", halign: "right" },
    },
  ];

  const itemRowsWithSummary: any[] = [
    ...(itemRows as any[]),
    totalsRow,
    amountWordsRow,
  ];

  const headRows: any[][] = [
    [
      { content: "Sr. No.", rowSpan: 2 },
      { content: "Description", rowSpan: 2 },
      { content: "SAC Code", rowSpan: 2 },
      { content: "Unit", rowSpan: 2 },
      { content: "Qty", rowSpan: 2 },
      { content: "Rate (INR)", rowSpan: 2 },
      { content: "Basic Amount (INR)", rowSpan: 2 },
      { content: "CGST", colSpan: 2 },
      { content: "SGST", colSpan: 2 },
      { content: "IGST", colSpan: 2 },
      { content: "Amount (INR)", rowSpan: 2 },
    ],
    [
      { content: "%" },
      { content: "Amt" },
      { content: "%" },
      { content: "Amt" },
      { content: "%" },
      { content: "Amt" },
    ],
  ];

  const itemTableStyles: any = {
    fontSize: tableFontSize,
    textColor: 0,
    lineColor: [0, 0, 0],
    cellPadding: 0.45,
    valign: "top",
    lineWidth: 0.15,
  };

  autoTable(doc, {
    startY: tableStartY,
    head: headRows,
    body: itemRowsWithSummary,
    theme: "grid",
    styles: itemTableStyles,
    headStyles: {
      textColor: 0,
      lineWidth: 0.15,
      fontSize: tableFontSize,
      fillColor: [255, 255, 255],
    },
    margin: margin,
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right" },
      12: { halign: "right" },
      13: { halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      const summaryStartIndex = (itemRows as any[]).length;
      if (data.row.index < summaryStartIndex) return;

      const totalsRowIndex = summaryStartIndex;
      const amountWordsRowIndex = summaryStartIndex + 1;

      // Default for summary rows: no vertical lines (keep only horizontal)
      data.cell.styles.lineWidth = {
        top: 0.15,
        bottom: 0.15,
        left: 0,
        right: 0,
      };

      // Totals row: show vertical lines starting from Basic Amount column (index 6)
      if (data.row.index === totalsRowIndex) {
        if (data.column.index >= 6) {
          data.cell.styles.lineWidth = 0.15;
        }
        return;
      }

      // Amount in words row: show vertical separator between words and final amount
      if (data.row.index === amountWordsRowIndex) {
        if (data.column.index === 0) {
          data.cell.styles.lineWidth = {
            top: 0.15,
            bottom: 0.15,
            left: 0,
            right: 0.15,
          };
          return;
        }
        if (data.column.index === 13) {
          data.cell.styles.lineWidth = {
            top: 0.15,
            bottom: 0.15,
            left: 0.15,
            right: 0,
          };
          return;
        }
        return;
      }
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(margin, tableStartY, usableWidth, tableEndY - tableStartY);
  doc.setLineWidth(0.15);

  let cursorY = tableEndY + 6;
  const signatureBoxHeight = 16;
  const footerSpace = 10;
  const padX = margin + 4;

  const paymentTermsFromJoin = Array.isArray(swo.subContractorWorkOrderPaymentTerms)
    ? ((swo.subContractorWorkOrderPaymentTerms as any[])
        .map((pt) =>
          safeText(
            pt?.paymentTerm?.description || pt?.paymentTerm?.paymentTerm || "-"
          )
        )
        .filter((t) => t && t !== "-"))
    : [];
  const paymentTermsToPrint =
    paymentTermsFromJoin.length > 0
      ? paymentTermsFromJoin
      : swo.paymentTermsInDays != null
      ? [`${swo.paymentTermsInDays} DAYS`]
      : ["-"];

  // Terms & Conditions section
  const termsText = [
    "1) Work shall be executed as per the specifications and quality standards mentioned in the work order.",
    "2) All safety norms and site regulations must be strictly followed during execution.",
    "3) Payment terms:",
    ...paymentTermsToPrint.map((t) => `   ${safeText(t)}`),
    "4) Work Order validity is upto 30 days from the date of issue.",
    "5) Please quote work order number in all invoices, challans and related correspondence.",
    "6) Jurisdiction: Mumbai Courts.",
  ].join("\n");
  const termsHeader = "Terms & Conditions:";
  const otherNotesLine = `Note: ${safeText(swo.note)}`;
  const fullTermsWithNotes = [termsText, otherNotesLine].filter(Boolean).join("\n\n");

  doc.setFont("helvetica", "bold");
  const termsHeadingHeight = lineHeight + 2;
  const termsLines = doc.splitTextToSize(fullTermsWithNotes || "-", usableWidth);
  const termsHeight =
    (Array.isArray(termsLines) ? termsLines.length : 0) * lineHeight;
  cursorY = ensureSpace(
    doc,
    cursorY,
    termsHeadingHeight + termsHeight + signatureBoxHeight + footerSpace,
    margin
  );
  doc.text(termsHeader, padX, cursorY);
  doc.setFont("helvetica", "normal");
  const termsBlock = Array.isArray(termsLines)
    ? termsLines.map((t: any) => ({ text: t }))
    : [{ text: String(termsLines) }];
  drawWrappedLines(doc, termsBlock, padX, cursorY + 6, usableWidth - 4, lineHeight);
  cursorY = cursorY + 5 + termsHeight + 5;

  // Acknowledgement text
  const ackText = "Please acknowledge the order and confirm acceptance";
  doc.setFont("helvetica", "bold");
  const ackLines = doc.splitTextToSize(ackText, usableWidth);
  const ackHeight =
    (Array.isArray(ackLines) ? ackLines.length : 0) * lineHeight;
  cursorY = ensureSpace(
    doc,
    cursorY,
    ackHeight + signatureBoxHeight + footerSpace,
    margin
  );
  doc.text(ackLines as any, padX, cursorY);
  cursorY = cursorY + ackHeight + 6;

  const forCompanyName =
    safeText(((swo as any).site as any)?.company?.companyName) !== "-"
      ? safeText(((swo as any).site as any)?.company?.companyName)
      : "Dynasoure Concrete Treatment Pvt Ltd.";
  doc.setFont("helvetica", "bold");
  doc.text(`For M/s ${forCompanyName}`, padX, cursorY);
  cursorY = cursorY + lineHeight + 4;

  // Signature section
  cursorY = ensureSpace(
    doc,
    cursorY,
    signatureBoxHeight + footerSpace + 6,
    margin
  );
  const signatureBoxY = cursorY + 6;
  doc.setFont("helvetica", "bold");
  doc.text("Authorised Signatory", padX, signatureBoxY + 8);

  const watermark = getWatermarkText(swo.status, !!swo.isApproved2);
  if (watermark) applyWatermark(doc, watermark);

  const pdfBuf = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfBuf);

  // Save to disk
  const uploadDir = path.join(process.cwd(), "uploads", "sub-contractor-work-orders");
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `swo-${id}-${crypto.randomUUID()}.pdf`;
  const relativePath = path.join("uploads", "sub-contractor-work-orders", filename);
  const fullPath = path.join(process.cwd(), relativePath);
  await fs.writeFile(fullPath, buffer);

  // Update DB
  await prisma.subContractorWorkOrder.update({
    where: { id },
    data: {
      subContractorWorkOrderfilePath: relativePath,
      isApproved2Printed: (swo as any).isApproved2 ? true : false,
    },
  });

  return new NextResponse(pdfBuf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sub-contractor-work-order-${swo.workOrderNo || id}.pdf"`,
    },
  });
}
