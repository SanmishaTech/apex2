import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { BadRequest, NotFound } from "@/lib/api-response";
import jsPDF from "jspdf";
import autoTable, { type CellDef } from "jspdf-autotable";
import { format } from "date-fns";

function formatDateSafe(value?: Date | string | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "dd-MM-yyyy");
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
      terms: true,
      paymentTermsInDays: true,
      paymentTerm: {
        select: {
          description: true,
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
      indent: {
        select: {
          indentNo: true,
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

  if (!purchaseOrder) return NotFound("Purchase order not found");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, usableWidth, pageHeight - margin * 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.rect(margin, margin, usableWidth, 10);
  doc.text("PURCHASE ORDER", pageWidth / 2, margin + 7, {
    align: "center",
  });

  doc.saveGraphicsState();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(60);
  doc.setTextColor(230);
  doc.text(purchaseOrder.approvalStatus ?? "DRAFT", pageWidth / 2, 160, {
    align: "center",
    angle: -40,
  });
  doc.restoreGraphicsState();
  doc.setTextColor(0);

  const topBoxY = margin + 14;
  const halfWidth = usableWidth / 2;
  const topBoxX = margin;

  doc.setFontSize(9);
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
    { text: `State Code : ${safeText(purchaseOrder.vendor?.stateCode)}` },
  ];
  // Prepare billing/PO/delivery blocks

  const billing = purchaseOrder.billingAddress;
  const billingPhone = [billing?.landline1, billing?.landline2]
    .filter(Boolean)
    .join(", ");
  const billingLines = [
    { text: "Billing Address", bold: true },
    { text: safeText(billing?.companyName), bold: true },
    { text: safeText(billing?.addressLine1) },
    { text: safeText(billing?.addressLine2) },
    {
      text: [
        safeText(billing?.city?.city),
        safeText(billing?.state?.state),
        safeText(billing?.pincode),
      ]
        .filter((line) => line !== "-")
        .join(", "),
    },
    { text: `Email : ${safeText(billing?.email)}` },
    { text: `Contact : ${billingPhone || "-"}` },
    { text: `GST No : ${safeText(billing?.gstNumber)}` },
    { text: `State Code : ${safeText(billing?.stateCode)}` },
  ];

  const poHeaderLines = [
    { text: "INLAND PURCHASE ORDER", bold: true },
    { text: `P O Number : ${safeText(purchaseOrder.purchaseOrderNo)}` },
    { text: `Date : ${formatDateSafe(purchaseOrder.purchaseOrderDate)}` },
    { text: `Quotation No : ${safeText(purchaseOrder.quotationNo)}` },
    { text: `Quotation Date : ${formatDateSafe(purchaseOrder.quotationDate)}` },
    { text: `Indent No : ${safeText(purchaseOrder.indent?.indentNo)}` },
  ];

  const deliver = purchaseOrder.siteDeliveryAddress;
  const deliverLines = [
    { text: "Deliver to :", bold: true },
    {
      text: safeText(purchaseOrder.site?.shortName || purchaseOrder.site?.site),
      bold: true,
    },
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
    {
      text: `Contact Person : ${safeText(
        purchaseOrder.site?.company?.contactPerson
      )}`,
    },
    {
      text: `Contact No : ${safeText(purchaseOrder.site?.company?.contactNo)}`,
    },
  ];
  // Compute dynamic heights for top/bottom halves and draw the box & dividers
  const colTextWidth = halfWidth - 4; // padding 2mm on each side
  const lineHeight = 3.2;
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

  const summaryYStart = topBoxY + topBoxHeight + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const summaryText =
    "Dear Sir/Madam :\nWe are pleased to confirm our purchase order against your Quotation. You are requested to supply the following items as per terms and\nconditions attached. Please quote purchase order no in challan,invoice and related correspondence.";
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

  const tableStartY = summaryYStart + summaryHeight + 4;
  // Build item rows matching screenshot format
  const itemRows = purchaseOrder.purchaseOrderDetails.map((detail, index) => [
    (index + 1).toString(),
    [
      detail.item?.item ?? "",
      detail.item?.description ? String(detail.item.description) : "",
    ]
      .filter(Boolean)
      .join("\n"),
    detail.item?.hsnCode ?? "",
    detail.item?.unit?.unitName ?? "",
    formatNumber(detail.qty, 3),
    formatNumber(detail.rate, 3),
    formatNumber(detail.discountPercent),
    formatCurrency(detail.disAmt),
    formatNumber(detail.cgstPercent),
    formatCurrency(detail.cgstAmt),
    formatNumber(detail.sgstPercent),
    formatCurrency(detail.sgstAmt),
    formatNumber(detail.igstPercent),
    formatCurrency(detail.igstAmt),
    formatCurrency(detail.amount),
  ]);

  const headRows: CellDef[][] = [
    [
      { content: "Sr. No.", rowSpan: 2 as any },
      { content: "Material Description", rowSpan: 2 as any },
      { content: "HSN/SAC Code", rowSpan: 2 as any },
      { content: "Unit", rowSpan: 2 as any },
      { content: "Qty", rowSpan: 2 as any },
      { content: "Rate (INR)", rowSpan: 2 as any },
      { content: "Discount", colSpan: 2 as any },
      { content: "CGST", colSpan: 2 as any },
      { content: "SGST", colSpan: 2 as any },
      { content: "IGST", colSpan: 2 as any },
      { content: "Amount (INR)", rowSpan: 2 as any },
    ],
    [
      { content: "Rate" },
      { content: "Amt" },
      { content: "Rate" },
      { content: "Amt" },
      { content: "Rate" },
      { content: "Amt" },
      { content: "Rate" },
      { content: "Amt" },
    ],
  ];

  const itemTableStyles: any = {
    fontSize: 7,
    cellPadding: 1.5,
    valign: "top",
    lineWidth: 0.4,
  };

  autoTable(doc, {
    startY: tableStartY,
    head: headRows,
    body: itemRows,
    theme: "grid",
    styles: itemTableStyles,
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
    },
    margin: margin,
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
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
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;
  doc.setLineWidth(0.4);
  doc.rect(margin, tableStartY, usableWidth, tableEndY - tableStartY);
  doc.setLineWidth(0.2);

  const totals = purchaseOrder.purchaseOrderDetails.reduce(
    (acc, detail) => {
      const amount = Number(detail.amount ?? 0);
      const cgst = Number(detail.cgstAmt ?? 0);
      const sgst = Number(detail.sgstAmt ?? 0);
      const igst = Number(detail.igstAmt ?? 0);
      const discount = Number(detail.disAmt ?? 0);
      return {
        amount: acc.amount + amount,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        igst: acc.igst + igst,
        discount: acc.discount + discount,
      };
    },
    { amount: 0, cgst: 0, sgst: 0, igst: 0, discount: 0 }
  );

  const transitAmount =
    purchaseOrder.transitInsuranceStatus === null
      ? Number(purchaseOrder.transitInsuranceAmount ?? 0)
      : 0;
  const pfAmount =
    purchaseOrder.pfStatus === null ? Number(purchaseOrder.pfCharges ?? 0) : 0;
  const gstReverseAmount =
    purchaseOrder.gstReverseStatus === null
      ? Number(purchaseOrder.gstReverseAmount ?? 0)
      : 0;

  const baseAmount = totals.amount - totals.cgst - totals.sgst - totals.igst;
  const totalGST = totals.cgst + totals.sgst + totals.igst;
  const grandTotal =
    Number(purchaseOrder.amount ?? 0) ||
    baseAmount +
      totals.cgst +
      totals.sgst +
      totals.igst +
      transitAmount +
      pfAmount +
      gstReverseAmount;

  const chargesY = tableEndY + 6;

  // Build a 4-column grid: [Left Label, Left Value, Right Label, Right Value]
  const leftValuePaymentTerms = purchaseOrder.paymentTerm?.description ?? "-";

  const validityText = safeText(
    "If you have any query, please revert within 48 hours, else we will presume that order is accepted by you. Purchase Order validity is upto 30 days"
  );
  const jurisText =
    "Mumbai Courts, please refer the general terms and conditions governing this PO.";

  const amountWords =
    safeText(purchaseOrder.amountInWords) || "Rupees Zero Only";
  const chargesRows: any[][] = [
    [
      "Delivery Schedule:",
      safeText(purchaseOrder.deliverySchedule),
      "Transport Charges",
      safeText(purchaseOrder.transport),
    ],
    [
      "Payment Terms:",
      leftValuePaymentTerms,
      "Transit Insurance",
      transitAmount ? formatCurrency(transitAmount) : "Inclusive",
    ],
    [
      "Validity:",
      validityText,
      "Total Amount before Tax",
      formatCurrency(baseAmount),
    ],
    [
      "Jurisdiction & Conditions:",
      jurisText,
      "CGST",
      formatCurrency(totals.cgst),
    ],
    [
      "Note:",
      safeText(purchaseOrder.note),
      "SGST",
      formatCurrency(totals.sgst),
    ],
    ["", "", "IGST", formatCurrency(totals.igst)],
    ["", "", "Total GST", formatCurrency(totalGST)],
    [
      "",
      "",
      "GST Reverse Charge",
      gstReverseAmount ? formatCurrency(gstReverseAmount) : "Not Applicable",
    ],
    [
      { content: amountWords, colSpan: 2, styles: { fontStyle: "bold" } },
      "Total Amount",
      formatCurrency(grandTotal),
    ],
  ];

  const leftSectionWidth = usableWidth * 0.6;
  const rightSectionWidth = usableWidth * 0.4;

  const boldRightLabels = new Set([
    "Total Amount before Tax",
    "Total GST",
    "Total Amount",
  ]);

  const chargesTableStyles: any = {
    fontSize: 8,
    cellPadding: 1.2,
    lineWidth: 0.4,
  };

  autoTable(doc, {
    startY: chargesY,
    body: chargesRows as any,
    theme: "grid",
    styles: chargesTableStyles,
    margin: margin,
    columnStyles: {
      0: { cellWidth: leftSectionWidth * 0.45 },
      1: { cellWidth: leftSectionWidth * 0.55 },
      2: { cellWidth: rightSectionWidth * 0.65 },
      3: { cellWidth: rightSectionWidth * 0.35, halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 2) {
        const label = String(data.cell.raw ?? "");
        if (boldRightLabels.has(label)) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const chargesTableEndY = (doc as any).lastAutoTable.finalY;
  doc.setLineWidth(0.4);
  doc.rect(margin, chargesY, usableWidth, chargesTableEndY - chargesY);
  doc.setLineWidth(0.2);

  const afterChargesY = chargesTableEndY + 4;

  let termsStartY = afterChargesY + 4;
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", margin, termsStartY);
  doc.setFont("helvetica", "normal");
  const termLines = [
    "Material shall be subject to approval for quality assurance and performance parameters as per the datasheet. Any rejections shall be on the supplier’s account.",
    "Material Test Certificate (MTC) must be sent along with the material.",
    "Material should be dispatched as per the given dispatch schedule.",
    "Material should be delivered in sealed-pack condition with a minimum shelf life of 6 months.",
    "All invoices must be sent in duplicate to the Head Office for smooth release of payment and must include the Purchase Order number.",
  ];
  const termsSpec = [{ text: termLines.join("\n") }];
  const termsHeight = measureWrappedLinesHeight(
    doc,
    termsSpec,
    usableWidth,
    lineHeight
  );

  const signatureBoxHeight = 20;
  const footerSpace = 10;
  const totalNeeded = 5 + termsHeight + 6 + signatureBoxHeight + footerSpace;
  if (termsStartY + totalNeeded > pageHeight - margin) {
    doc.addPage();
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.rect(margin, margin, usableWidth, pageHeight - margin * 2);
    termsStartY = margin + 14;
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions", margin, termsStartY);
    doc.setFont("helvetica", "normal");
  }

  drawWrappedLines(
    doc,
    termsSpec as any,
    margin,
    termsStartY + 5,
    usableWidth,
    lineHeight
  );

  const signatureBoxY = termsStartY + 5 + termsHeight + 6;
  doc.rect(margin, signatureBoxY, usableWidth, signatureBoxHeight);
  doc.line(
    margin + usableWidth / 2,
    signatureBoxY,
    margin + usableWidth / 2,
    signatureBoxY + signatureBoxHeight
  );
  doc.setFont("helvetica", "bold");
  doc.text("Signature", margin + 4, signatureBoxY + signatureBoxHeight - 8);
  doc.text(
    "Authorised Signatory",
    margin + usableWidth / 2 + 4,
    signatureBoxY + signatureBoxHeight - 8
  );

  const totalPages = doc.getNumberOfPages();
  doc.setFontSize(8);
  const footerText = `Apex Constructions    Generated on ${format(
    new Date(),
    "dd-MM-yyyy HH:mm"
  )}`;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const y = pageHeight - margin;
    doc.text(footerText, margin, y);
    doc.text(`Page ${i}/${totalPages}`, pageWidth - margin, y, {
      align: "right",
    });
  }

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
