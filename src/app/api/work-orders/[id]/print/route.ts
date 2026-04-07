import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { BadRequest, NotFound } from "@/lib/api-response";
import jsPDF from "jspdf";
import autoTable, { type CellDef } from "jspdf-autotable";
import { format } from "date-fns";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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

// Load logo from site's company (no fallback)
async function loadLogoDataUrl(logoPath?: string | null): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const idParam = (await context.params).id;
  const id = Number.parseInt(idParam, 10);
  if (Number.isNaN(id)) return BadRequest("Invalid work order ID");

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true,
      workOrderNo: true,
      workOrderDate: true,
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
      pfStatus: true,
      pfCharges: true,
      approvalStatus: true,
      isApproved2: true,
      WorkOrderfilePath: true,
      isApproved2Printed: true,
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
      workOrderDetails: {
        select: {
          serialNo: true,
          Item: true,
          qty: true,
          rate: true,
          cgstPercent: true,
          cgstAmt: true,
          sgstPercent: true,
          sgstAmt: true,
          igstPercent: true,
          igstAmt: true,
          amount: true,
          unit: {
            select: {
              unitName: true,
            },
          },
        },
        orderBy: {
          serialNo: "asc",
        },
      },
    },
  });

  if (!workOrder) {
    return NextResponse.json(
      { error: "Work order not found" },
      { status: 404 }
    );
  }

  // If already approved2 and already printed, return saved file
  if ((workOrder as any).isApproved2 && (workOrder as any).isApproved2Printed && (workOrder as any).WorkOrderfilePath) {
    try {
      const fullPath = path.join(process.cwd(), (workOrder as any).WorkOrderfilePath);
      const fileContent = await fs.readFile(fullPath);
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="work-order-${workOrder.workOrderNo || id}.pdf"`,
        },
      });
    } catch (e) {
      console.error("Failed to read saved work order PDF, regenerating...", e);
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const usableWidth = pageWidth - margin * 2;

  // Logo - from site's company (no fallback)
  const logoHeight = 22;
  const logoWidth = 78;
  const logoY = margin;
  try {
    const logo = await loadLogoDataUrl((workOrder as any).site?.company?.logoUrl);
    if (logo) {
      const logoX = pageWidth - margin - logoWidth;
      doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoWidth, logoHeight);
    }
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.rect(margin, margin, usableWidth, 10);
  doc.text("WORK ORDER", pageWidth / 2, margin + 7, {
    align: "center",
  });

  doc.saveGraphicsState();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(60);
  doc.setTextColor(230);
  doc.text(workOrder.approvalStatus ?? "DRAFT", pageWidth / 2, 160, {
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
    workOrder.vendor?.mobile1,
    workOrder.vendor?.mobile2,
  ]
    .filter(Boolean)
    .join(", ");
  const vendorLines = [
    { text: `To,`, bold: true },
    { text: `M/s ${safeText(workOrder.vendor?.vendorName)}`, bold: true },
    { text: safeText(workOrder.vendor?.addressLine1) },
    { text: safeText(workOrder.vendor?.addressLine2) },
    {
      text: [
        safeText(workOrder.vendor?.city?.city),
        safeText(workOrder.vendor?.state?.state),
        safeText(workOrder.vendor?.pincode),
      ]
        .filter((line) => line !== "-")
        .join(", "),
    },
    {
      text: `Contact Person : ${safeText(workOrder.vendor?.contactPerson)}`,
    },
    { text: `Contact No : ${vendorPhone || "-"}` },
    { text: `Email Id : ${safeText(workOrder.vendor?.email)}` },
    { text: `GST No : ${safeText(workOrder.vendor?.gstNumber)}` },
    { text: `State Code : ${safeText(workOrder.vendor?.stateCode)}` },
  ];
  drawLines(doc, vendorLines, topBoxX + 2, topBoxY + 6);

  const billing = workOrder.billingAddress;
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
    { text: "WORK ORDER", bold: true },
    { text: `Work Order No : ${safeText(workOrder.workOrderNo)}` },
    { text: `Date : ${formatDateSafe(workOrder.workOrderDate)}` },
    { text: `Quotation No : ${safeText(workOrder.quotationNo)}` },
    { text: `Quotation Date : ${formatDateSafe(workOrder.quotationDate)}` },
  ];
  drawLines(doc, poHeaderLines, topBoxX + halfWidth + 2, topBoxY + 6);

  const deliver = workOrder.siteDeliveryAddress;
  const deliverLines = [
    { text: "Deliver to :", bold: true },
    {
      text: safeText(workOrder.site?.shortName || workOrder.site?.site),
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
        workOrder.site?.company?.contactPerson
      )}`,
    },
    {
      text: `Contact No : ${safeText(workOrder.site?.company?.contactNo)}`,
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
  const itemRows = workOrder.workOrderDetails.map((detail, index) => [
    (index + 1).toString(),
    detail.Item ?? "",
    "",
    formatNumber(detail.qty, 3),
    detail.unit?.unitName ?? "",
    formatNumber(detail.rate),
    "",
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

  const totals = workOrder.workOrderDetails.reduce(
    (acc, detail) => {
      const amount = Number(detail.amount ?? 0);
      const cgst = Number(detail.cgstAmt ?? 0);
      const sgst = Number(detail.sgstAmt ?? 0);
      const igst = Number(detail.igstAmt ?? 0);
      return {
        amount: acc.amount + amount,
        cgst: acc.cgst + cgst,
        sgst: acc.sgst + sgst,
        igst: acc.igst + igst,
        discount: acc.discount,
      };
    },
    { amount: 0, cgst: 0, sgst: 0, igst: 0, discount: 0 }
  );

  const pfAmount =
    workOrder.pfStatus === null ? Number(workOrder.pfCharges ?? 0) : 0;

  const baseAmount = totals.amount - totals.cgst - totals.sgst - totals.igst;
  const grandTotal =
    Number(workOrder.amount ?? 0) ||
    baseAmount +
      totals.cgst +
      totals.sgst +
      totals.igst +
      pfAmount;

  const chargesY = tableEndY + 6;

  autoTable(doc, {
    startY: chargesY,
    body: [
      ["Delivery Schedule", safeText(workOrder.deliverySchedule)],
      [
        "Payment Terms",
        workOrder.paymentTermsInDays
          ? `${workOrder.paymentTermsInDays} Days from WO`
          : "As per WO",
      ],
      ["Transport", safeText(workOrder.transport)],
      [
        "Validity",
        safeText(
          workOrder.terms ??
            "Terms & Conditions apply as per negotiated agreement"
        ),
      ],
      ["Jurisdiction & Conditions", safeText(workOrder.note)],
      ["PF Charges", pfAmount ? formatCurrency(pfAmount) : "Inclusive"],
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
      safeText(workOrder.amountInWords) || "Rupees Zero Only",
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

  const pdfBytes = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfBytes);

  // Save to disk
  const uploadDir = path.join(process.cwd(), "uploads", "work-orders");
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `wo-${id}-${crypto.randomUUID()}.pdf`;
  const relativePath = path.join("uploads", "work-orders", filename);
  const fullPath = path.join(process.cwd(), relativePath);
  await fs.writeFile(fullPath, buffer);

  // Update DB
  await prisma.workOrder.update({
    where: { id },
    data: {
      WorkOrderfilePath: relativePath,
      isApproved2Printed: (workOrder as any).isApproved2 ? true : false,
    },
  });

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="work-order-${workOrder.workOrderNo ?? id}.pdf"`,
    },
  });
}
