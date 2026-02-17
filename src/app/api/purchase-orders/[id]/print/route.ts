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

function safeText(value?: string | null) {
  return value?.trim() ? value.trim() : "-";
}

function displayCharge(value: unknown) {
  if (value === null) return "-";
  if (value === undefined) return "-";
  return value as string | number;
}

function toNumberOrZero(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

// Measure total height of wrapped lines for a given width
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

// Draw wrapped lines within a given width
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

// Try to load a logo image from public/ with reasonable fallbacks
async function loadLogoDataUrl(): Promise<{
  dataUrl: string;
  format: "PNG" | "JPEG";
} | null> {
  const candidates = [path.join("images", "DCTPL-logo.png")]; // check png/jpg
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
  if (Number.isNaN(id)) return BadRequest("Invalid purchase order ID");

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true,
      purchaseOrderNo: true,
      purchaseOrderDate: true,
      deliveryDate: true,
      quotationNo: true,
      quotationDate: true,
      transport: true,
      note: true,
      remarks: true,
      terms: true,
      paymentTermsInDays: true,
      paymentTerm: {
        select: {
          description: true,
        },
      },
      poPaymentTerms: {
        select: {
          paymentTermId: true,
          paymentTerm: {
            select: {
              description: true,
              paymentTerm: true,
            },
          },
        },
      },
      deliverySchedule: true,
      amount: true,
      amountInWords: true,
      totalCgstAmount: true,
      totalSgstAmount: true,
      totalIgstAmount: true,
      transitInsuranceStatus: true,
      transitInsuranceAmount: true,
      pfStatus: true,
      pfCharges: true,
      gstReverseStatus: true,
      gstReverseAmount: true,
      poStatus: true,
      approvalStatus: true,
      purchaseOrderIndent: {
        select: {
          indent: {
            select: {
              indentNo: true,
            },
          },
        },
      },
      site: {
        select: {
          site: true,
          shortName: true,
          addressLine1: true,
          addressLine2: true,
          city: {
            select: {
              city: true,
            },
          },
          state: {
            select: {
              state: true,
            },
          },
          pinCode: true,
          siteContactPersons: {
            take: 1,
            orderBy: { id: "asc" },
            select: {
              name: true,
              contactNo: true,
              email: true,
            },
          },
          company: {
            select: {
              companyName: true,
              contactPerson: true,
              contactNo: true,
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
          stateCode: true,
          city: {
            select: {
              city: true,
            },
          },
          state: {
            select: {
              state: true,
            },
          },
          pincode: true,
          gstNumber: true,
        },
      },
      billingAddress: {
        select: {
          companyName: true,
          addressLine1: true,
          addressLine2: true,
          city: {
            select: {
              city: true,
            },
          },
          state: {
            select: {
              state: true,
            },
          },
          stateCode: true,
          pincode: true,
          gstNumber: true,
          email: true,
          landline1: true,
          landline2: true,
        },
      },
      siteDeliveryAddress: {
        select: {
          addressLine1: true,
          addressLine2: true,
          pinCode: true,
          city: {
            select: {
              city: true,
            },
          },
          state: {
            select: {
              state: true,
            },
          },
        },
      },
      purchaseOrderDetails: {
        select: {
          serialNo: true,
          qty: true,
          rate: true,
          discountPercent: true,
          disAmt: true,
          cgstPercent: true,
          cgstAmt: true,
          sgstPercent: true,
          sgstAmt: true,
          igstPercent: true,
          igstAmt: true,
          amount: true,
          item: {
            select: {
              item: true,
              itemCode: true,
              description: true,
              hsnCode: true,
              unit: {
                select: {
                  unitName: true,
                },
              },
            },
          },
        },
        orderBy: {
          serialNo: "asc",
        },
      },
    },
  });

  if (!purchaseOrder) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  const indentNos = Array.from(
    new Set(
      ((purchaseOrder as any).purchaseOrderIndent || [])
        .map((x: any) => x?.indent?.indentNo)
        .filter((v: any) => typeof v === "string" && v.trim() !== "")
    )
  );
  const indentNoLabel = indentNos.length > 0 ? indentNos.join(", ") : "";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setTextColor(0);
  doc.setDrawColor(0);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8; // tighter margins to help fit one page
  const usableWidth = pageWidth - margin * 2;

  const headingFontSize = 10;
  const smallFontSize = 7;
  const tableFontSize = 7;
  const lineHeight = 3.0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  // Place the company logo from public/ (fallbacks supported) - top-right with larger sizing
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
  doc.text("PURCHASE ORDER", pageWidth / 2, headerY, {
    align: "center",
  });

  const topBoxY = headerY + 3;
  const halfWidth = usableWidth / 2;
  const topBoxX = margin;

  doc.setFontSize(smallFontSize);
  const vendorPhone = [
    purchaseOrder.vendor?.mobile1,
    purchaseOrder.vendor?.mobile2,
  ]
    .filter(Boolean)
    .join(", ");
  const vendorLines = [
    { text: `To,`, bold: true },
    { text: `M/s ${safeText(purchaseOrder.vendor?.vendorName)}`, bold: true },
    { text: safeText(purchaseOrder.vendor?.addressLine1) },
    { text: safeText(purchaseOrder.vendor?.addressLine2) },
    {
      text: [
        safeText(purchaseOrder.vendor?.city?.city),
        safeText(purchaseOrder.vendor?.state?.state),
        safeText(purchaseOrder.vendor?.pincode),
      ]
        .filter((line) => line !== "-")
        .join(", "),
    },
    {
      text: `Contact Person : ${safeText(purchaseOrder.vendor?.contactPerson)}`,
    },
    { text: `Contact No : ${vendorPhone || "-"}` },
    { text: `Email Id : ${safeText(purchaseOrder.vendor?.email)}` },
    { text: `GST No : ${safeText(purchaseOrder.vendor?.gstNumber)}` },
  ];

  const billing = purchaseOrder.billingAddress;
  const billingPhone = [billing?.landline1, billing?.landline2]
    .filter(Boolean)
    .join(", ");
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
    { text: `Email : ${safeText(billing?.email)}` },
    { text: `Contact : ${billingPhone || "-"}` },
    { text: `GST No : ${safeText(billing?.gstNumber)}` },
  ];

  const poHeaderLines = [
    { text: "INLAND PURCHASE ORDER", bold: true },
    { text: `P O Number : ${safeText(purchaseOrder.purchaseOrderNo)}` },
    { text: `Quotation Date : ${formatDateSafe(purchaseOrder.quotationDate)}` },
    { text: `Delivery Date : ${formatDateSafe(purchaseOrder.deliveryDate)}` },
    { text: `Indent No : ${safeText(indentNoLabel)}` },
  ];

  const deliver = purchaseOrder.siteDeliveryAddress;
  const firstSiteContact = (purchaseOrder.site as any)?.siteContactPersons?.[0];
  const deliverLines = [
    { text: "Delivery/Shipping Address :", bold: true },
    { text: safeText(deliver?.addressLine1) },
    { text: safeText(deliver?.addressLine2) },
    { text: safeText(deliver?.state?.state) },
    {
      text: `Contact Person : ${safeText(firstSiteContact?.name)}`,
    },
    {
      text: `Contact No : ${safeText(firstSiteContact?.contactNo)}`,
    },
    {
      text: `Email Id : ${safeText(firstSiteContact?.email)}`,
    },
  ];

  // Compute dynamic heights for top/bottom halves and draw the box & dividers
  const colTextWidth = halfWidth - 4; // padding 2mm on each side
  const vendorHeight = measureWrappedLinesHeight(
    doc,
    vendorLines,
    colTextWidth,
    lineHeight
  );
  const poHeaderHeight = measureWrappedLinesHeight(
    doc,
    poHeaderLines,
    colTextWidth,
    lineHeight
  );
  const topHalfHeight = Math.max(vendorHeight, poHeaderHeight) + 8; // include top/bottom padding

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
    poHeaderLines,
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
    "Dear Sir/Madam: Kindly supply the following items as per agreed Rate, terms and conditions.";
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
  // Build item rows matching screenshot format
  const itemRows = purchaseOrder.purchaseOrderDetails.map((detail, index) => {
    const qtyNum = toNumberOrZero(detail.qty);
    const rateNum = toNumberOrZero(detail.rate);
    const basicAmountNum = qtyNum * rateNum;
    return [
      (index + 1).toString(),
      [
        detail.item?.item ?? "",
        detail.item?.description ? String(detail.item.description) : "",
      ]
        .filter(Boolean)
        .join("\n"),
      detail.item?.hsnCode ?? "",
      detail.item?.unit?.unitName ?? "",
      formatNumber(detail.qty, 4),
      formatNumber(detail.rate, 3),
      formatCurrency(basicAmountNum),
      formatNumber(detail.discountPercent),
      formatCurrency(detail.disAmt),
      formatNumber(detail.cgstPercent),
      formatCurrency(detail.cgstAmt),
      formatNumber(detail.sgstPercent),
      formatCurrency(detail.sgstAmt),
      formatNumber(detail.igstPercent),
      formatCurrency(detail.igstAmt),
      formatCurrency(detail.amount),
    ];
  });

  const totals = purchaseOrder.purchaseOrderDetails.reduce(
    (acc, detail) => {
      const qtyNum = toNumberOrZero(detail.qty);
      const rateNum = toNumberOrZero(detail.rate);
      const basicAmount = qtyNum * rateNum;
      const amount = Number(detail.amount ?? 0);
      const cgst = Number(detail.cgstAmt ?? 0);
      const sgst = Number(detail.sgstAmt ?? 0);
      const igst = Number(detail.igstAmt ?? 0);
      const discount = Number(detail.disAmt ?? 0);
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

  const transitAmountRaw = purchaseOrder.transitInsuranceAmount;
  const pfAmountRaw = purchaseOrder.pfCharges;
  const gstReverseAmountRaw = purchaseOrder.gstReverseAmount;

  const transitAmountNum = toNumberOrZero(transitAmountRaw);
  const pfAmountNum = toNumberOrZero(pfAmountRaw);
  const gstReverseAmountNum = toNumberOrZero(gstReverseAmountRaw);

  const grandTotal =
    Number(purchaseOrder.amount ?? 0) ||
    totals.amount + transitAmountNum + pfAmountNum + gstReverseAmountNum;

  const amountWords =
    safeText(purchaseOrder.amountInWords) || "Rupees Zero Only";
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

  const transportRow: any[] = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    { content: "Transport\u00A0Charges", styles: { halign: "right" } },
    { content: displayCharge(pfAmountRaw), styles: { halign: "right" } },
  ];

  const transitRow: any[] = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    { content: "Transit\u00A0Insurance", styles: { halign: "right" } },
    { content: displayCharge(transitAmountRaw), styles: { halign: "right" } },
  ];

  const gstReverseRow: any[] = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    { content: "GST\u00A0Reverse\u00A0Charge", styles: { halign: "right" } },
    { content: displayCharge(gstReverseAmountRaw), styles: { halign: "right" } },
  ];

  const amountWordsRow: any[] = [
    {
      content: amountWordsDisplay,
      colSpan: 15,
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
    transportRow,
    transitRow,
    gstReverseRow,
    amountWordsRow,
  ];

  const headRows: CellDef[][] = [
    [
      { content: "Sr. No.", rowSpan: 2 as any },
      { content: "Material Description", rowSpan: 2 as any },
      { content: "HSN/SAC", rowSpan: 2 as any },
      { content: "Unit", rowSpan: 2 as any },
      { content: "Qty", rowSpan: 2 as any },
      { content: "Rate (INR)", rowSpan: 2 as any },
      { content: "Basic Amount (INR)", rowSpan: 2 as any },
      { content: "Discount", colSpan: 2 as any },
      { content: "CGST", colSpan: 2 as any },
      { content: "SGST", colSpan: 2 as any },
      { content: "IGST", colSpan: 2 as any },
      { content: "Amount (INR)", rowSpan: 2 as any },
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
      14: { halign: "right" },
      15: { halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      const summaryStartIndex = (itemRows as any[]).length;
      if (data.row.index < summaryStartIndex) return;

      const totalsRowIndex = summaryStartIndex;
      const transportRowIndex = summaryStartIndex + 1;
      const transitRowIndex = summaryStartIndex + 2;
      const gstReverseRowIndex = summaryStartIndex + 3;
      const amountWordsRowIndex = summaryStartIndex + 4;

      // Default for summary rows: no vertical lines (keep only horizontal)
      data.cell.styles.lineWidth = {
        top: 0.15,
        bottom: 0.15,
        left: 0,
        right: 0,
      };

      // Totals row: show vertical lines starting from Rate column (index 5)
      if (data.row.index === totalsRowIndex) {
        if (data.column.index >= 5) {
          data.cell.styles.lineWidth = 0.15;
        }
        return;
      }

      // Charge rows: show only a single vertical separator between label (IGST area)
      // and Amount column.
      if (
        data.row.index === transportRowIndex ||
        data.row.index === transitRowIndex ||
        data.row.index === gstReverseRowIndex
      ) {
        // Label is column 14 and amount is column 15
        if (data.column.index === 14) {
          data.cell.styles.lineWidth = {
            top: 0.15,
            bottom: 0.15,
            left: 0.15,
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
  const signatureBoxHeight = 16; // compact signature box
  const footerSpace = 10;
  const padX = margin + 4; // extra left padding to avoid touching border

  const paymentTermsFromJoin = Array.isArray((purchaseOrder as any).poPaymentTerms)
    ? (((purchaseOrder as any).poPaymentTerms as any[])
        .map((pt) =>
          safeText(
            pt?.paymentTerm?.description || pt?.paymentTerm?.paymentTerm || "-"
          )
        )
        .filter((t) => t && t !== "-"))
    : [];
  const leftValuePaymentTerms = purchaseOrder.paymentTerm?.description ?? "-";
  const paymentTermsToPrint =
    paymentTermsFromJoin.length > 0
      ? paymentTermsFromJoin
      : leftValuePaymentTerms && leftValuePaymentTerms !== "-"
      ? [safeText(leftValuePaymentTerms)]
      : ["-"];

  const validityText = safeText(
    "Purchase Order validity is upto 30 days."
  );

  // Terms & Conditions section
  const termsText = [
    "4) Material Shall be Subject to approval for quality assurance & performance parameters as per datasheet. Rejections, if any, shall be on your account.",
    "5) Material Test Certificate (MTC) should be sent along with the material.",
    "6) Material should be dispatched as per given dispatch schedule.",
    "7) Material should be delivered in seal pack condition with minimum 6 months shelf life.",
    "8) All invoices must be sent in duplicate to the head office for smooth release of payment and must include the purchase order number.",
    "9) Jurisdiction & Conditions: Mumbai Courts, please refer the general terms and conditions governing this PO.",
  ].join("\n");
  const termsHeader = "Terms & Conditions:";
  const paymentTermLines = [
    "2) Payment terms:",
    ...paymentTermsToPrint.map((t) => `   ${safeText(t)}`),
  ].join("\n");
  const termsIntroLines = [
    `1) Delivery Schedule: ${safeText(purchaseOrder.deliverySchedule)}`,
    paymentTermLines,
    `3) Validity: ${validityText}`,
  ].join("\n");

  const otherNotesLine = `10) Other Notes: ${safeText(purchaseOrder.note)}`;
  const fullTermsText = [termsIntroLines, termsText].filter(Boolean).join("\n\n");
  const fullTermsWithNotes = [fullTermsText, otherNotesLine]
    .filter(Boolean)
    .join("\n\n");

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
    ? termsLines.map((t) => ({ text: t }))
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
    safeText((purchaseOrder.site as any)?.company?.companyName) !== "-"
      ? safeText((purchaseOrder.site as any)?.company?.companyName)
      : "Dynasoure Concrete Treatment Pvt Ltd.";
  doc.setFont("helvetica", "bold");
  doc.text(`For M/s ${forCompanyName}`, padX, cursorY);
  cursorY = cursorY + lineHeight + 4;

  // Signature section: ensure room, otherwise push to next page
  cursorY = ensureSpace(
    doc,
    cursorY,
    signatureBoxHeight + footerSpace + 6,
    margin
  );
  const signatureBoxY = cursorY + 6;
  doc.setFont("helvetica", "bold");
  doc.text("Authorised Signatory", padX, signatureBoxY + 8);

  // const totalPages = doc.getNumberOfPages();
  // doc.setFontSize(smallFontSize);
  // doc.setFont("helvetica", "bold");
  // const footerLeft = "DCTPL";
  // const footerCenter = `Generated on ${format(
  //   new Date(),
  //   "dd/MM/yyyy hh:mm a"
  // )}`;
  // for (let i = 1; i <= totalPages; i++) {
  //   doc.setPage(i);
  //   // Draw a horizontal line below the outer border and place footer outside the box
  //   const lineY = pageHeight - margin - 4; // lift footer for better bottom margin
  //   doc.setDrawColor(0);
  //   doc.line(margin, lineY, pageWidth - margin, lineY);
  //   const y = lineY + 4; // footer below the line
  //   doc.text(footerLeft, padX, y);
  //   doc.text(footerCenter, pageWidth / 2, y, { align: "center" });
  //   doc.text(`Page ${i}/${totalPages}`, pageWidth - padX, y, {
  //     align: "right",
  //   });
  // }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="purchase-order-${
        purchaseOrder.purchaseOrderNo ?? id
      }.pdf"`,
    },
  });
}
