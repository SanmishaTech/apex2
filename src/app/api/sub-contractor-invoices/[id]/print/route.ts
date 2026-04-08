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

// Try to load a logo image from site's company (same pattern as Purchase Order)
async function loadLogoDataUrl(logoPath?: string | null): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  if (!logoPath) {
    // No fallback - if no company logo, don't show any logo
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

function getWatermarkText(status?: string | null, isAuthorized?: boolean) {
  const s = String(status || "PENDING").toUpperCase();
  if (s === "APPROVED" || isAuthorized) return null;
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
  const auth = await guardApiPermissions(req, [PERMISSIONS.PRINT_SUB_CONTRACTOR_INVOICES]);
  if (auth.ok === false) return auth.response;

  const idParam = (await context.params).id;
  const id = Number.parseInt(idParam, 10);
  if (Number.isNaN(id)) return BadRequest("Invalid invoice ID");

  const invoice = await prisma.subContractorInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      siteId: true,
      subcontractorWorkOrderId: true,
      invoiceNumber: true,
      invoiceDate: true,
      fromDate: true,
      toDate: true,
      grossAmount: true,
      retentionAmount: true,
      tds: true,
      lwf: true,
      otherDeductions: true,
      netPayable: true,
      amountInWords: true,
      subContractorInvoicefilePath: true,
      isAuthorized: true,
      isAuthorizedPrinted: true,
      status: true,
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
      subcontractorWorkOrder: {
        select: {
          workOrderNo: true,
          workOrderDate: true,
          subContractor: {
            select: {
              name: true,
              contactPerson: true,
              addressLine1: true,
              addressLine2: true,
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
        },
      },
      subContractorInvoiceDetails: {
        select: {
          id: true,
          particulars: true,
          workOrderQty: true,
          currentBillQty: true,
          rate: true,
          discountPercent: true,
          discountAmount: true,
          cgstPercent: true,
          sgstpercent: true,
          igstPercent: true,
          cgstAmt: true,
          sgstAmt: true,
          igstAmt: true,
          totalLineAmount: true,
          subContractorWorkOrderDetailId: true,
          subContractorWorkOrderDetail: {
            select: {
              item: true,
              unit: { select: { unitName: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
      createdBy: {
        select: { name: true },
      },
      authorizedBy: {
        select: { name: true },
      },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // If already authorized and already printed, return saved file
  if ((invoice as any).isAuthorized && (invoice as any).isAuthorizedPrinted && (invoice as any).subContractorInvoicefilePath) {
    try {
      const fullPath = path.join(process.cwd(), (invoice as any).subContractorInvoicefilePath);
      const fileContent = await fs.readFile(fullPath);
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="sub-contractor-invoice-${invoice.invoiceNumber || id}.pdf"`,
        },
      });
    } catch (e) {
      console.error("Failed to read saved invoice PDF, regenerating...", e);
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

  function formatNumber(value: unknown, fractionDigits = 2) {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return "0";
    return num.toLocaleString("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
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
    const companyLogoUrl = ((invoice as any).site as any)?.company?.logoUrl;
    const logo = await loadLogoDataUrl(companyLogoUrl);
    if (logo) {
      const logoX = pageWidth - margin - logoWidth;
      doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoWidth, logoHeight);
    }
  } catch {}

  const headerY = logoY + logoHeight + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  doc.text("SUB CONTRACTOR INVOICE", pageWidth / 2, headerY, {
    align: "center",
  });

  const topBoxY = headerY + 3;
  const halfWidth = usableWidth / 2;
  const topBoxX = margin;

  doc.setFontSize(smallFontSize);

  const subCon = (invoice as any).subcontractorWorkOrder?.subContractor;
  const vendorLines = [
    { text: `To,`, bold: true },
    { text: `M/s ${safeText(subCon?.name)}`, bold: true },
    { text: safeText(subCon?.addressLine1) },
    { text: safeText(subCon?.addressLine2) },
    { text: `Contact Person : ${safeText(subCon?.contactPerson)}` },
    { text: `GST No : ${safeText(subCon?.gstNumber)}` },
  ];

  const wo = (invoice as any).subcontractorWorkOrder;
  const invoiceHeaderLines = [
    { text: "INVOICE", bold: true },
    { text: `Invoice No : ${safeText(invoice.invoiceNumber)}` },
    { text: `Invoice Date : ${formatDateSafe(invoice.invoiceDate)}` },
    { text: `Period : ${formatDateSafe(invoice.fromDate)} to ${formatDateSafe(invoice.toDate)}` },
    { text: `Work Order No : ${safeText(wo?.workOrderNo)}` },
    { text: `WO Date : ${formatDateSafe(wo?.workOrderDate)}` },
  ];

  const billing = wo?.billingAddress;
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

  const siteShortName = (invoice.site as any)?.shortName || (invoice.site as any)?.site || "";
  const siteLines = [
    { text: "Site Address :", bold: true },
    { text: safeText(siteShortName), bold: true },
    { text: safeText((invoice.site as any)?.addressLine1) },
    { text: safeText((invoice.site as any)?.addressLine2) },
    {
      text: [
        safeText((invoice.site as any)?.city?.city),
        safeText((invoice.site as any)?.state?.state),
        safeText((invoice.site as any)?.pinCode),
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
  const invoiceHeaderHeight = measureWrappedLinesHeight(
    doc,
    invoiceHeaderLines,
    colTextWidth,
    lineHeight
  );
  const topHalfHeight = Math.max(vendorHeight, invoiceHeaderHeight) + 8;

  const billingHeight = measureWrappedLinesHeight(
    doc,
    billingLines,
    colTextWidth,
    lineHeight
  );
  const siteHeight = measureWrappedLinesHeight(
    doc,
    siteLines,
    colTextWidth,
    lineHeight
  );
  const bottomHalfHeight = Math.max(billingHeight, siteHeight) + 8;

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
    invoiceHeaderLines,
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
    siteLines,
    topBoxX + halfWidth + 2,
    topBoxY + topHalfHeight + 6,
    colTextWidth,
    lineHeight
  );

  const summaryGap = 3;
  const tableStartY = topBoxY + topBoxHeight + summaryGap;

  // Build item rows
  const details = (invoice as any).subContractorInvoiceDetails || [];
  const itemRows = details.map((it: any, index: number) => {
    const qtyNum = Number(it.currentBillQty ?? 0);
    const rateNum = Number(it.rate ?? 0);
    const baseAmount = qtyNum * rateNum;
    const discountAmt = Number(it.discountAmount ?? 0);
    const taxableAmount = baseAmount - discountAmt;
    return [
      (index + 1).toString(),
      it.subContractorWorkOrderDetail?.item || it.particulars || "-",
      it.subContractorWorkOrderDetail?.unit?.unitName || "-",
      formatNumber(it.workOrderQty, 2),
      formatNumber(it.currentBillQty, 2),
      formatNumber(it.rate, 2),
      formatCurrency(baseAmount),
      formatNumber(it.discountPercent),
      formatCurrency(it.discountAmount),
      formatNumber(it.cgstPercent),
      formatCurrency(it.cgstAmt),
      formatNumber(it.sgstpercent),
      formatCurrency(it.sgstAmt),
      formatNumber(it.igstPercent),
      formatCurrency(it.igstAmt),
      formatCurrency(it.totalLineAmount),
    ];
  });

  const totals = details.reduce(
    (acc: any, it: any) => {
      const qtyNum = Number(it.currentBillQty ?? 0);
      const rateNum = Number(it.rate ?? 0);
      const baseAmount = qtyNum * rateNum;
      const amount = Number(it.totalLineAmount ?? 0);
      const cgst = Number(it.cgstAmt ?? 0);
      const sgst = Number(it.sgstAmt ?? 0);
      const igst = Number(it.igstAmt ?? 0);
      const discount = Number(it.discountAmount ?? 0);
      return {
        basicAmount: acc.basicAmount + baseAmount,
        amount: acc.amount + amount,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        igst: acc.igst + igst,
        discount: acc.discount + discount,
      };
    },
    { basicAmount: 0, amount: 0, cgst: 0, sgst: 0, igst: 0, discount: 0 }
  );

  const grossTotal = Number(invoice.grossAmount ?? 0) || totals.amount;

  const amountWords = safeText(invoice.amountInWords) || "Rupees Zero Only";
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
      content: formatCurrency(totals.discount),
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

  const deductionsRows: any[] = [];
  if (Number(invoice.retentionAmount) > 0) {
    deductionsRows.push([
      { content: "Less: Retention", colSpan: 15, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatCurrency(invoice.retentionAmount), styles: { halign: "right" } },
    ]);
  }
  if (Number(invoice.tds) > 0) {
    deductionsRows.push([
      { content: "Less: TDS", colSpan: 15, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatCurrency(invoice.tds), styles: { halign: "right" } },
    ]);
  }
  if (Number(invoice.lwf) > 0) {
    deductionsRows.push([
      { content: "Less: LWF", colSpan: 15, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatCurrency(invoice.lwf), styles: { halign: "right" } },
    ]);
  }
  if (Number(invoice.otherDeductions) > 0) {
    deductionsRows.push([
      { content: "Less: Other Deductions", colSpan: 15, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatCurrency(invoice.otherDeductions), styles: { halign: "right" } },
    ]);
  }

  const netPayableRow: any[] = [
    {
      content: amountWordsDisplay,
      colSpan: 15,
      styles: { fontStyle: "bold", halign: "left" },
    },
    {
      content: formatCurrency(invoice.netPayable),
      styles: { fontStyle: "bold", halign: "right" },
    },
  ];

  const itemRowsWithSummary: any[] = [
    ...(itemRows as any[]),
    totalsRow,
    ...deductionsRows,
    netPayableRow,
  ];

  const headRows: any[][] = [
    [
      { content: "Sr. No.", rowSpan: 2 },
      { content: "Description", rowSpan: 2 },
      { content: "Unit", rowSpan: 2 },
      { content: "WO Qty", rowSpan: 2 },
      { content: "Bill Qty", rowSpan: 2 },
      { content: "Rate (INR)", rowSpan: 2 },
      { content: "Basic Amount (INR)", rowSpan: 2 },
      { content: "Discount", colSpan: 2 },
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
      3: { halign: "right" },
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
      14: { halign: "right" },
      15: { halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      const summaryStartIndex = (itemRows as any[]).length;
      if (data.row.index < summaryStartIndex) return;

      const totalsRowIndex = summaryStartIndex;
      const deductionsStartIndex = summaryStartIndex + 1;
      const deductionsEndIndex = deductionsStartIndex + deductionsRows.length;
      const netPayableRowIndex = deductionsEndIndex;

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

      // Deductions rows: keep full grid lines
      if (
        deductionsRows.length > 0 &&
        data.row.index >= deductionsStartIndex &&
        data.row.index < deductionsEndIndex
      ) {
        data.cell.styles.lineWidth = 0.15;
        return;
      }

      // Net payable row: show vertical separator between words and final amount
      if (data.row.index === netPayableRowIndex) {
        if (data.column.index === 0) {
          data.cell.styles.lineWidth = {
            top: 0.15,
            bottom: 0.15,
            left: 0,
            right: 0.15,
          };
          return;
        }
        if (data.column.index === 15) {
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

  // Terms & Conditions section
  const termsHeader = "Terms & Conditions:";
  const termsText = [
    "1) Payment shall be made as per the agreed payment terms.",
    "2) Retention amount shall be released as per contract terms.",
    "3) All deductions (TDS, LWF, Other) are statutory or as per agreement.",
    "4) Jurisdiction: Mumbai Courts.",
    `5) Invoice Status: ${safeText(invoice.status)}`,
  ].join("\n");

  doc.setFont("helvetica", "bold");
  const termsHeadingHeight = lineHeight + 2;
  const termsLines = doc.splitTextToSize(termsText || "-", usableWidth);
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
  const ackText = "Please acknowledge receipt of this invoice";
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
    safeText(((invoice as any).site as any)?.company?.companyName) !== "-"
      ? safeText(((invoice as any).site as any)?.company?.companyName)
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

  const watermark = getWatermarkText(invoice.status, !!invoice.isAuthorized);
  if (watermark) applyWatermark(doc, watermark);

  const pdfBytes = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfBytes);

  // Save to disk
  const uploadDir = path.join(process.cwd(), "uploads", "sub-contractor-invoices");
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `sci-${id}-${crypto.randomUUID()}.pdf`;
  const relativePath = path.join("uploads", "sub-contractor-invoices", filename);
  const fullPath = path.join(process.cwd(), relativePath);
  await fs.writeFile(fullPath, buffer);

  // Update DB and create log entry in a transaction
  await prisma.$transaction(async (tx) => {
    // Update the invoice
    await tx.subContractorInvoice.update({
      where: { id },
      data: {
        subContractorInvoicefilePath: relativePath,
        isAuthorizedPrinted: (invoice as any).isAuthorized ? true : false,
      },
    });

    // Get the user name for the log
    const user = await tx.user.findUnique({
      where: { id: auth.user.id },
      select: { name: true },
    });

    // Create main log entry with type UPDATE
    const log = await tx.subContractorInvoiceLog.create({
      data: {
        subContractorInvoiceId: id,
        siteId: invoice.siteId,
        subcontractorWorkOrderId: invoice.subcontractorWorkOrderId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        fromDate: invoice.fromDate,
        toDate: invoice.toDate,
        logType: "UPDATE",
        grossAmount: invoice.grossAmount,
        retentionAmount: invoice.retentionAmount,
        tds: invoice.tds,
        lwf: invoice.lwf,
        otherDeductions: invoice.otherDeductions,
        netPayable: invoice.netPayable,
        status: invoice.status,
        isAuthorized: (invoice as any).isAuthorized,
        amountInWords: invoice.amountInWords,
        subContractorInvoicefilePath: relativePath,
        isAuthorizedPrinted: (invoice as any).isAuthorized ? true : false,
        createdById: auth.user.id,
        createdByName: user?.name || "Unknown",
      },
    });

    // Create detail logs from the invoice details
    const detailLogsData = invoice.subContractorInvoiceDetails.map((detail) => ({
      subContractorInvoiceLogId: log.id,
      subContractorInvoiceDetailId: detail.id,
      subContractorWorkOrderDetailId: detail.subContractorWorkOrderDetailId,
      particulars: detail.particulars,
      workOrderQty: detail.workOrderQty,
      currentBillQty: detail.currentBillQty,
      rate: detail.rate,
      discountPercent: detail.discountPercent,
      discountAmount: detail.discountAmount,
      cgstPercent: detail.cgstPercent,
      sgstpercent: detail.sgstpercent,
      igstPercent: detail.igstPercent,
      cgstAmt: detail.cgstAmt,
      sgstAmt: detail.sgstAmt,
      igstAmt: detail.igstAmt,
      totalLineAmount: detail.totalLineAmount,
    }));

    await tx.subContractorInvoiceDetailLog.createMany({
      data: detailLogsData,
    });
  });

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sub-contractor-invoice-${invoice.invoiceNumber || id}.pdf"`,
    },
  });
}
