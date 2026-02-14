import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json(
      { error: "Purchase order not found" },
      { status: 404 }
    );
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
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
  const topBoxHeight = 66;
  const halfWidth = usableWidth / 2;
  const topBoxX = margin;

  doc.setDrawColor(0);
  doc.rect(topBoxX, topBoxY, usableWidth, topBoxHeight);
  doc.line(
    topBoxX + halfWidth,
    topBoxY,
    topBoxX + halfWidth,
    topBoxY + topBoxHeight
  );
  doc.line(
    topBoxX,
    topBoxY + topBoxHeight / 2,
    topBoxX + halfWidth,
    topBoxY + topBoxHeight / 2
  );
  doc.line(
    topBoxX + halfWidth,
    topBoxY + topBoxHeight / 2,
    topBoxX + usableWidth,
    topBoxY + topBoxHeight / 2
  );

  doc.setFontSize(10);
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
  drawLines(doc, vendorLines, topBoxX + 2, topBoxY + 6);

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
  drawLines(doc, billingLines, topBoxX + 2, topBoxY + topBoxHeight / 2 + 6);

  const poHeaderLines = [
    { text: "INLAND PURCHASE ORDER", bold: true },
    { text: `Purchase Order No : ${safeText(purchaseOrder.purchaseOrderNo)}` },
    { text: `Date : ${formatDateSafe(purchaseOrder.purchaseOrderDate)}` },
    { text: `Quotation No : ${safeText(purchaseOrder.quotationNo)}` },
    { text: `Quotation Date : ${formatDateSafe(purchaseOrder.quotationDate)}` },
    { text: `Indent No : ${safeText(indentNoLabel)}` },
  ];
  drawLines(doc, poHeaderLines, topBoxX + halfWidth + 2, topBoxY + 6);

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
  drawLines(
    doc,
    deliverLines,
    topBoxX + halfWidth + 2,
    topBoxY + topBoxHeight / 2 + 6
  );

  const summaryYStart = topBoxY + topBoxHeight + 6;
  doc.setFont("helvetica", "normal");
  doc.text(
    doc.splitTextToSize(
      "We are pleased to confirm our purchase order against your quotation. Please acknowledge the following items as per terms and conditions.",
      usableWidth
    ),
    margin,
    summaryYStart
  );

  const tableStartY = summaryYStart + 8;
  const itemRows = purchaseOrder.purchaseOrderDetails.map((detail, index) => [
    (index + 1).toString(),
    detail.item?.item ?? "",
    detail.item?.itemCode ?? "",
    formatNumber(detail.qty, 3),
    detail.item?.unit?.unitName ?? "",
    formatNumber(detail.rate),
    formatNumber(detail.discountPercent),
    formatNumber(detail.cgstPercent),
    formatCurrency(detail.cgstAmt),
    formatNumber(detail.sgstPercent),
    formatCurrency(detail.sgstAmt),
    formatNumber(detail.igstPercent),
    formatCurrency(detail.igstAmt),
    formatCurrency(detail.amount),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [
      [
        "Sr No",
        "Material Description",
        "Code",
        "Qty",
        "Unit",
        "Rate",
        "Discount %",
        "CGST %",
        "CGST Amt",
        "SGST %",
        "SGST Amt",
        "IGST %",
        "IGST Amt",
        "Amount",
      ],
    ],
    body: itemRows,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      3: { halign: "right" },
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
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;

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

  autoTable(doc, {
    startY: chargesY,
    body: [
      ["Delivery Schedule", safeText(purchaseOrder.deliverySchedule)],
      [
        "Payment Terms",
        purchaseOrder.paymentTermsInDays
          ? `${purchaseOrder.paymentTermsInDays} Days from PO`
          : "As per PO",
      ],
      ["Transport", safeText(purchaseOrder.transport)],
      [
        "Validity",
        safeText(
          purchaseOrder.terms ??
            "Terms & Conditions apply as per negotiated agreement"
        ),
      ],
      ["Jurisdiction & Conditions", safeText(purchaseOrder.note)],
      [
        "Transit Insurance",
        transitAmount ? formatCurrency(transitAmount) : "Inclusive",
      ],
      ["PF Charges", pfAmount ? formatCurrency(pfAmount) : "Inclusive"],
      [
        "GST Reverse Charges",
        gstReverseAmount ? formatCurrency(gstReverseAmount) : "Not Applicable",
      ],
      ["Total Before Tax", formatCurrency(baseAmount)],
      ["CGST", formatCurrency(totals.cgst)],
      ["SGST", formatCurrency(totals.sgst)],
      ["IGST", formatCurrency(totals.igst)],
      ["Grand Total", formatCurrency(grandTotal)],
    ],
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
    },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.4 },
      1: { halign: "right" },
    },
  });

  const afterChargesY = (doc as any).lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "bold");
  doc.text("Rupees (in words)", margin, afterChargesY);
  doc.setFont("helvetica", "normal");
  doc.text(
    doc.splitTextToSize(
      safeText(purchaseOrder.amountInWords) || "Rupees Zero Only",
      usableWidth
    ),
    margin,
    afterChargesY + 5
  );

  const termsStartY = afterChargesY + 18;
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", margin, termsStartY);
  doc.setFont("helvetica", "normal");
  const termLines = [
    "Material supplied is subject to approval of quality assurance & performance parameters.",
    "Invoices must accompany delivery challan mentioning this purchase order number.",
    "Any dispute will be subject to Mumbai jurisdiction.",
  ];
  doc.text(
    doc.splitTextToSize(termLines.join("\n"), usableWidth),
    margin,
    termsStartY + 5
  );

  const signatureBoxY = termsStartY + 30;
  const signatureBoxHeight = 26;
  doc.rect(margin, signatureBoxY, usableWidth, signatureBoxHeight);
  doc.line(
    margin + usableWidth / 2,
    signatureBoxY,
    margin + usableWidth / 2,
    signatureBoxY + signatureBoxHeight
  );
  doc.setFont("helvetica", "bold");
  doc.text("Signature", margin + 4, signatureBoxY + 18);
  doc.text(
    "Authorised Signatory",
    margin + usableWidth / 2 + 4,
    signatureBoxY + 18
  );

  const footerY = signatureBoxY + signatureBoxHeight + 12;
  doc.setFontSize(8);
  const footerText = `Apex Constructions    Generated on ${format(
    new Date(),
    "dd-MM-yyyy HH:mm"
  )}`;
  doc.text(footerText, margin, footerY);
  doc.text("Page 1/1", pageWidth - margin, footerY, { align: "right" });

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
