import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { BadRequest, NotFound } from "@/lib/api-response";
import jsPDF from "jspdf";
import autoTable, { type CellDef } from "jspdf-autotable";
import { format } from "date-fns";
import fs from "fs/promises";
import path from "path";

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

function safeText(value?: string | number | null) {
  if (value == null) return "-";
  const str = String(value);
  return str.trim() ? str.trim() : "-";
}

function toNumberOrZero(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getInvoiceWatermarkText(authorizedById?: number | null) {
  return authorizedById ? null : "DRAFT";
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
    doc.setFontSize(80);
    doc.text(text, centerX, centerY, {
      align: "center",
      baseline: "middle",
      angle: 45,
    } as any);
    doc.restoreGraphicsState();
  }
}

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

async function loadLogoDataUrl(): Promise<{
  dataUrl: string;
  format: "PNG" | "JPEG";
} | null> {
  const candidates = [path.join("images", "DCTPL-logo.png")];
  for (const name of candidates) {
    try {
      const p = path.join(process.cwd(), "public", name);
      const buf = await fs.readFile(p);
      const isPng = name.toLowerCase().endsWith(".png");
      const fmt = isPng
        ? "PNG"
        : name.toLowerCase().endsWith(".jpg") ||
          name.toLowerCase().endsWith(".jpeg")
        ? "JPEG"
        : "PNG";
      const dataUrl = `data:image/${
        isPng ? "png" : "jpeg"
      };base64,${buf.toString("base64")}`;
      return { dataUrl, format: fmt as "PNG" | "JPEG" };
    } catch {}
  }
  return null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const idParam = (await context.params).id;
  const id = Number.parseInt(idParam, 10);
  if (Number.isNaN(id)) return BadRequest("Invalid sales invoice ID");

  const salesInvoice = await prisma.salesInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNumber: true,
      revision: true,
      invoiceDate: true,
      fromDate: true,
      toDate: true,
      grossAmount: true,
      tds: true,
      wct: true,
      lwf: true,
      other: true,
      totalAmount: true,
      authorizedById: true,
      site: {
        select: {
          site: true,
          shortName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          pinCode: true,
          state: {
            select: {
              state: true,
            },
          },
          company: {
            select: {
              companyName: true,
              gstNo: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              pinCode: true,
              contactNo: true,
            },
          },
        },
      },
      boq: {
        select: {
          workName: true,
          boqNo: true,
        },
      },
      billingAddress: {
        select: {
          companyName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          pincode: true,
          state: {
            select: {
              state: true,
            },
          },
          gstNumber: true,
          email: true,
        },
      },
      authorizedBy: {
        select: {
          name: true,
        },
      },
      salesInvoiceDetails: {
        select: {
          boqItem: {
            select: {
              item: true,
              unit: {
                select: {
                  unitName: true,
                },
              },
            },
          },
          particulars: true,
          totalBoqQty: true,
          invoiceQty: true,
          rate: true,
          discount: true,
          discountAmount: true,
          cgst: true,
          cgstAmt: true,
          sgst: true,
          sgstAmt: true,
          igst: true,
          igstAmt: true,
          amount: true,
        },
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!salesInvoice) {
    return NotFound("Sales invoice not found");
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  
  // Logo
  const logoHeight = 22;
  const logoWidth = 78;
  const logoY = margin;
  try {
    const logo = await loadLogoDataUrl();
    if (logo) {
      const logoX = pageWidth - margin - logoWidth;
      doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoWidth, logoHeight);
    }
  } catch {}

  const headerY = logoY + logoHeight + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  doc.text("SALES INVOICE", pageWidth / 2, headerY, {
    align: "center",
  });

  // Company Info (Left side)
  const company = (salesInvoice as any).site?.company;
  const companyLines = [
    { text: safeText(company?.companyName), bold: true },
    { text: safeText(company?.addressLine1) },
    { text: safeText(company?.addressLine2) },
    { text: `${safeText(company?.city)}, ${safeText(company?.pinCode)}` },
    { text: `GST: ${safeText(company?.gstNo)}` },
    { text: `Contact: ${safeText(company?.contactNo)}` },
  ];

  // Invoice Header (Right side)
  const invoiceHeaderLines = [
    { text: "INVOICE", bold: true },
    { text: `No: ${safeText(salesInvoice.invoiceNumber)}` },
    { text: `Rev: ${safeText(salesInvoice.revision)}` },
    { text: `Date: ${formatDateSafe(salesInvoice.invoiceDate)}` },
    { text: `Period: ${formatDateSafe(salesInvoice.fromDate)} - ${formatDateSafe(salesInvoice.toDate)}` },
  ];

  const topBoxY = headerY + 3;
  const halfWidth = usableWidth / 2;
  const topBoxX = margin;

  doc.setFontSize(smallFontSize);

  const colTextWidth = halfWidth - 4;
  const companyHeight = measureWrappedLinesHeight(
    doc,
    companyLines,
    colTextWidth,
    lineHeight
  );
  const invoiceHeaderHeight = measureWrappedLinesHeight(
    doc,
    invoiceHeaderLines,
    colTextWidth,
    lineHeight
  );
  const topBoxHeight = Math.max(companyHeight, invoiceHeaderHeight) + 8;

  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(topBoxX, topBoxY, usableWidth, topBoxHeight);
  doc.line(
    topBoxX + halfWidth,
    topBoxY,
    topBoxX + halfWidth,
    topBoxY + topBoxHeight
  );

  drawWrappedLines(
    doc,
    companyLines,
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

  // Billing Address
  const billingY = topBoxY + topBoxHeight + 4;
  const billing = (salesInvoice as any).billingAddress;
  const billingLines = [
    { text: "Bill To:", bold: true },
    { text: safeText(billing?.companyName), bold: true },
    { text: safeText(billing?.addressLine1) },
    { text: safeText(billing?.addressLine2) },
    { text: `${safeText(billing?.city)}, ${safeText(billing?.pincode)}` },
    { text: `State: ${safeText(billing?.state?.state)}` },
    { text: `GST: ${safeText(billing?.gstNumber)}` },
    { text: `Email: ${safeText(billing?.email)}` },
  ];

  const site = (salesInvoice as any).site;
  const siteLines = [
    { text: "Site Details:", bold: true },
    { text: safeText(site?.site), bold: true },
    { text: safeText(site?.addressLine1) },
    { text: safeText(site?.addressLine2) },
    { text: `${safeText(site?.city)}, ${safeText(site?.pinCode)}` },
    { text: `State: ${safeText(site?.state?.state)}` },
  ];

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
  const addressBoxHeight = Math.max(billingHeight, siteHeight) + 8;

  doc.rect(topBoxX, billingY, usableWidth, addressBoxHeight);
  doc.line(
    topBoxX + halfWidth,
    billingY,
    topBoxX + halfWidth,
    billingY + addressBoxHeight
  );

  drawWrappedLines(
    doc,
    billingLines,
    topBoxX + 2,
    billingY + 6,
    colTextWidth,
    lineHeight
  );
  drawWrappedLines(
    doc,
    siteLines,
    topBoxX + halfWidth + 2,
    billingY + 6,
    colTextWidth,
    lineHeight
  );

  // Items Table
  const tableStartY = billingY + addressBoxHeight + 6;
  
  const itemRows = ((salesInvoice as any).salesInvoiceDetails as any[]).map((detail, index) => {
    const qtyNum = toNumberOrZero(detail.invoiceQty);
    const rateNum = toNumberOrZero(detail.rate);
    const basicAmountNum = qtyNum * rateNum;
    return [
      (index + 1).toString(),
      safeText(detail.boqItem?.item),
      safeText(detail.particulars),
      safeText(detail.boqItem?.unit?.unitName),
      formatNumber(detail.invoiceQty, 2),
      formatNumber(detail.rate, 2),
      formatCurrency(basicAmountNum),
      formatNumber(detail.discount),
      formatCurrency(detail.discountAmount),
      formatNumber(detail.cgst),
      formatCurrency(detail.cgstAmt),
      formatNumber(detail.sgst),
      formatCurrency(detail.sgstAmt),
      formatNumber(detail.igst),
      formatCurrency(detail.igstAmt),
      formatCurrency(detail.amount),
    ];
  });

  const totals = ((salesInvoice as any).salesInvoiceDetails as any[]).reduce(
    (acc, detail) => {
      const qtyNum = toNumberOrZero(detail.invoiceQty);
      const rateNum = toNumberOrZero(detail.rate);
      const basicAmount = qtyNum * rateNum;
      const amount = Number(detail.amount ?? 0);
      const cgst = Number(detail.cgstAmt ?? 0);
      const sgst = Number(detail.sgstAmt ?? 0);
      const igst = Number(detail.igstAmt ?? 0);
      const discount = Number(detail.discountAmount ?? 0);
      return {
        basicAmount: acc.basicAmount + basicAmount,
        amount: acc.amount + amount,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        igst: acc.igst + igst,
        discount: acc.discount + discount,
      };
    },
    { basicAmount: 0, amount: 0, cgst: 0, sgst: 0, igst: 0, discount: 0 }
  );

  const grandTotal = toNumberOrZero(salesInvoice.totalAmount);

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

  const headRows: CellDef[][] = [
    [
      { content: "Sr.", rowSpan: 2 as any },
      { content: "Item", rowSpan: 2 as any },
      { content: "Particulars", rowSpan: 2 as any },
      { content: "Unit", rowSpan: 2 as any },
      { content: "Qty", rowSpan: 2 as any },
      { content: "Rate", rowSpan: 2 as any },
      { content: "Basic Amt", rowSpan: 2 as any },
      { content: "Discount", colSpan: 2 as any },
      { content: "CGST", colSpan: 2 as any },
      { content: "SGST", colSpan: 2 as any },
      { content: "IGST", colSpan: 2 as any },
      { content: "Amount", rowSpan: 2 as any },
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
    body: [...itemRows, totalsRow],
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
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "right", cellWidth: 12 },
      5: { halign: "right", cellWidth: 15 },
      6: { halign: "right", cellWidth: 18 },
      7: { halign: "right", cellWidth: 8 },
      8: { halign: "right", cellWidth: 15 },
      9: { halign: "right", cellWidth: 8 },
      10: { halign: "right", cellWidth: 15 },
      11: { halign: "right", cellWidth: 8 },
      12: { halign: "right", cellWidth: 15 },
      13: { halign: "right", cellWidth: 8 },
      14: { halign: "right", cellWidth: 15 },
      15: { halign: "right", cellWidth: 18 },
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;

  // Deductions and Final Total
  const deductionsY = tableEndY + 4;
  const deductionsX = pageWidth - margin - 80;
  
  doc.setFontSize(smallFontSize);
  doc.setFont("helvetica", "normal");
  
  let currentY = deductionsY;
  const lineSpacing = 4;

  doc.text(`Gross Amount:`, deductionsX, currentY);
  doc.text(formatCurrency(salesInvoice.grossAmount), deductionsX + 70, currentY, { align: "right" });
  currentY += lineSpacing;

  if (toNumberOrZero(salesInvoice.tds) > 0) {
    doc.text(`Less TDS:`, deductionsX, currentY);
    doc.text(formatCurrency(salesInvoice.tds), deductionsX + 70, currentY, { align: "right" });
    currentY += lineSpacing;
  }

  if (toNumberOrZero(salesInvoice.wct) > 0) {
    doc.text(`Less WCT:`, deductionsX, currentY);
    doc.text(formatCurrency(salesInvoice.wct), deductionsX + 70, currentY, { align: "right" });
    currentY += lineSpacing;
  }

  if (toNumberOrZero(salesInvoice.lwf) > 0) {
    doc.text(`Less LWF:`, deductionsX, currentY);
    doc.text(formatCurrency(salesInvoice.lwf), deductionsX + 70, currentY, { align: "right" });
    currentY += lineSpacing;
  }

  if (toNumberOrZero(salesInvoice.other) > 0) {
    doc.text(`Other Deductions:`, deductionsX, currentY);
    doc.text(formatCurrency(salesInvoice.other), deductionsX + 70, currentY, { align: "right" });
    currentY += lineSpacing;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Net Amount:`, deductionsX, currentY);
  doc.text(formatCurrency(salesInvoice.totalAmount), deductionsX + 70, currentY, { align: "right" });

  // Amount in words
  const wordsY = currentY + 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Amount in Words: ${safeText("Rupees " + amountInWords(Number(salesInvoice.totalAmount)) + " Only")}`, margin, wordsY);

  // Signature
  const signatureY = wordsY + 15;
  doc.setFont("helvetica", "bold");
  doc.text("For " + safeText(company?.companyName), margin, signatureY);
  
  if ((salesInvoice as any).authorizedBy?.name) {
    doc.setFont("helvetica", "normal");
    doc.text(`Authorized By: ${safeText((salesInvoice as any).authorizedBy.name)}`, margin, signatureY + 10);
  }

  doc.text("Authorized Signatory", margin, signatureY + 20);

  // Watermark
  const watermarkText = getInvoiceWatermarkText(salesInvoice.authorizedById);
  if (watermarkText) {
    applyWatermark(doc, watermarkText);
  }

  const pdfBytes = doc.output("arraybuffer");
  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="sales-invoice-${salesInvoice.invoiceNumber}.pdf"`,
    },
  });
}

// Helper function to convert amount to words
function amountInWords(amount: number): string {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function convertLessThanOneThousand(n: number): string {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + units[n % 10] : "");
    }
    return units[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertLessThanOneThousand(n % 100) : "");
  }

  function convert(n: number): string {
    if (n === 0) return "Zero";
    
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const remainder = n;

    let result = "";
    if (crore > 0) result += convertLessThanOneThousand(crore) + " Crore ";
    if (lakh > 0) result += convertLessThanOneThousand(lakh) + " Lakh ";
    if (thousand > 0) result += convertLessThanOneThousand(thousand) + " Thousand ";
    if (remainder > 0) result += convertLessThanOneThousand(remainder);

    return result.trim();
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = convert(rupees);
  if (paise > 0) {
    result += " and " + convert(paise) + " Paise";
  }
  
  return result;
}
