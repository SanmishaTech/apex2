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

async function loadLogoDataUrl(): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  const candidates = [path.join("images", "DCTPL-logo.png")];
  for (const name of candidates) {
    try {
      const p = path.join(process.cwd(), "public", name);
      const buf = await fs.readFile(p);
      const isPng = name.toLowerCase().endsWith(".png");
      const fmt = isPng ? "PNG" : "JPEG";
      const dataUrl = `data:image/${isPng ? "png" : "jpeg"};base64,${buf.toString("base64")}`;
      return { dataUrl, format: fmt } as any;
    } catch (e) {
      // ignore
    }
  }
  return null;
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
    include: {
      site: {
        select: {
          site: true,
          shortName: true,
          addressLine1: true,
          addressLine2: true,
          city: { select: { city: true } },
          state: { select: { state: true } },
          pinCode: true,
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

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setTextColor(0);
  doc.setDrawColor(0);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;

  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      const logoW = 60;
      const logoH = 25;
      const logoX = pageWidth - margin - logoW;
      const logoY = 8;
      doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoW, logoH);
    } catch (e) {}
  }

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Sub Contractor Invoice", pageWidth / 2, 20, { align: "center" } as any);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice No: ${invoice.invoiceNumber || "-"}`, pageWidth / 2, 26, { align: "center" } as any);

  // Set global smaller font for print
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  let y = 35;

  // Header info table - Two columns
  const leftLines = [] as string[];
  leftLines.push("To,");
  leftLines.push(invoice.subcontractorWorkOrder?.subContractor?.name || "M/s -");
  const subCon = invoice.subcontractorWorkOrder?.subContractor;
  if (subCon?.addressLine1) leftLines.push(subCon.addressLine1);
  if (subCon?.addressLine2) leftLines.push(subCon.addressLine2);
  leftLines.push(`Contact: ${subCon?.contactPerson || "-"}`);
  leftLines.push(`GST No: ${subCon?.gstNumber || "-"}`);

  const rightLines = [] as string[];
  rightLines.push(`Invoice Date: ${formatDateSafe(invoice.invoiceDate)}`);
  rightLines.push(`Period: ${formatDateSafe(invoice.fromDate)} to ${formatDateSafe(invoice.toDate)}`);
  rightLines.push(`Work Order: ${invoice.subcontractorWorkOrder?.workOrderNo || "-"}`);
  rightLines.push(`WO Date: ${formatDateSafe(invoice.subcontractorWorkOrder?.workOrderDate)}`);
  rightLines.push(`Status: ${invoice.status || "PENDING"}`);

  (autoTable as any)(doc as any, {
    startY: y,
    body: [
      [{ content: leftLines.join("\n") }, { content: rightLines.join("\n") }],
    ],
    styles: { fontSize: 9, textColor: 0 },
    theme: "grid",
    head: [],
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: pageWidth / 2 - margin }, 1: { cellWidth: pageWidth / 2 - margin } },
  });

  // Billing Address section
  const billing = invoice.subcontractorWorkOrder?.billingAddress;
  const billingLines = [] as string[];
  billingLines.push("Billing Address:");
  billingLines.push(billing?.companyName || "-");
  if (billing?.addressLine1) billingLines.push(billing.addressLine1);
  if (billing?.addressLine2) billingLines.push(billing.addressLine2);
  const billCity = billing?.city?.city || "";
  const billState = billing?.state?.state || "";
  const billPin = billing?.pincode || "";
  if (billCity || billPin || billState) billingLines.push(`${billCity} - ${billPin}, ${billState}`);
  billingLines.push(`GST No: ${billing?.gstNumber || "-"}`);

  const afterHeaderY = (doc as any).lastAutoTable?.finalY || y + 30;

  // Items table
  const details = invoice.subContractorInvoiceDetails || [];
  const itemsBody = details.map((it: any, idx: number) => {
    return [
      String(idx + 1),
      it.subContractorWorkOrderDetail?.item || it.particulars || "-",
      it.subContractorWorkOrderDetail?.unit?.unitName || "-",
      formatCurrency(it.workOrderQty),
      formatCurrency(it.currentBillQty),
      formatCurrency(it.rate),
      `${it.discountPercent || 0}%`,
      formatCurrency(it.discountAmount),
      `${it.cgstPercent || 0}%`,
      formatCurrency(it.cgstAmt),
      `${it.sgstpercent || 0}%`,
      formatCurrency(it.sgstAmt),
      `${it.igstPercent || 0}%`,
      formatCurrency(it.igstAmt),
      formatCurrency(it.totalLineAmount),
    ];
  });

  (autoTable as any)(doc as any, {
    startY: afterHeaderY + 5,
    tableWidth: pageWidth - margin * 2,
    head: [
      [
        { content: "Sr.No", rowSpan: 2 },
        { content: "Item / Description", rowSpan: 2 },
        { content: "Unit", rowSpan: 2 },
        { content: "WO Qty", rowSpan: 2 },
        { content: "Bill Qty", rowSpan: 2 },
        { content: "Rate", rowSpan: 2 },
        { content: "Discount", colSpan: 2, halign: "center" },
        { content: "CGST", colSpan: 2, halign: "center" },
        { content: "SGST", colSpan: 2, halign: "center" },
        { content: "IGST", colSpan: 2, halign: "center" },
        { content: "Amount", rowSpan: 2 },
      ],
      [
        "%", "Amt",
        "%", "Amt",
        "%", "Amt",
        "%", "Amt",
      ]
    ],
    body: itemsBody,
    styles: { fontSize: 7, textColor: 0, lineColor: 0, cellPadding: 1.5 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", lineWidth: 0.1 },
    theme: "grid",
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 15, halign: "right" },
      4: { cellWidth: 15, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 10, halign: "right" },
      7: { cellWidth: 14, halign: "right" },
      8: { cellWidth: 10, halign: "right" },
      9: { cellWidth: 14, halign: "right" },
      10: { cellWidth: 10, halign: "right" },
      11: { cellWidth: 14, halign: "right" },
      12: { cellWidth: 10, halign: "right" },
      13: { cellWidth: 14, halign: "right" },
      14: { cellWidth: 20, halign: "right" },
    },
  });

  const afterItemsY = (doc as any).lastAutoTable?.finalY || afterHeaderY + 40;

  // Totals section
  const totalsBody: any[] = [];
  totalsBody.push([
    { content: "", colSpan: 2, styles: { fillColor: [255, 255, 255] } },
    { content: "Gross Amount:", styles: { halign: "right", fontStyle: "bold" } },
    { content: formatCurrency(invoice.grossAmount), styles: { halign: "right" } },
  ]);
  if (Number(invoice.retentionAmount) > 0) {
    totalsBody.push([
      { content: "", colSpan: 2 },
      { content: "Less Retention:", styles: { halign: "right" } },
      { content: formatCurrency(invoice.retentionAmount), styles: { halign: "right" } },
    ]);
  }
  if (Number(invoice.tds) > 0) {
    totalsBody.push([
      { content: "", colSpan: 2 },
      { content: "Less TDS:", styles: { halign: "right" } },
      { content: formatCurrency(invoice.tds), styles: { halign: "right" } },
    ]);
  }
  if (Number(invoice.lwf) > 0) {
    totalsBody.push([
      { content: "", colSpan: 2 },
      { content: "Less LWF:", styles: { halign: "right" } },
      { content: formatCurrency(invoice.lwf), styles: { halign: "right" } },
    ]);
  }
  if (Number(invoice.otherDeductions) > 0) {
    totalsBody.push([
      { content: "", colSpan: 2 },
      { content: "Less Other:", styles: { halign: "right" } },
      { content: formatCurrency(invoice.otherDeductions), styles: { halign: "right" } },
    ]);
  }
  totalsBody.push([
    { content: "", colSpan: 2, styles: { fillColor: [255, 255, 255] } },
    { content: "Net Payable:", styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
    { content: formatCurrency(invoice.netPayable), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
  ]);

  (autoTable as any)(doc as any, {
    startY: afterItemsY + 5,
    body: totalsBody,
    styles: { fontSize: 9, textColor: 0 },
    theme: "grid",
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: pageWidth - margin * 2 - 50 - 40 - 40 },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
  });

  // Signature section
  const afterTotalsY = (doc as any).lastAutoTable?.finalY || afterItemsY + 30;
  const sigStartY = afterTotalsY + 15;
  const colW = (pageWidth - margin * 2) / 3;
  const leftX = margin;
  const midX = margin + colW;
  const rightX = margin + colW * 2;
  const sigLineY = sigStartY + 12;

  doc.setLineWidth(0.5);
  doc.setDrawColor(0);
  doc.line(leftX, sigLineY, leftX + colW - 20, sigLineY);
  doc.line(midX, sigLineY, midX + colW - 20, sigLineY);
  // doc.line(rightX, sigLineY, rightX + colW - 20, sigLineY); // Removed Received by

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Prepared by", leftX, sigLineY + 6);
  doc.text("Authorized by", midX, sigLineY + 6);
  // doc.text("Received by", rightX, sigLineY + 6);

  // Watermark
  const watermark = getWatermarkText(invoice.status, !!invoice.isAuthorized);
  if (watermark) applyWatermark(doc, watermark);

  // Border on every page
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(0);
    doc.setLineWidth(0.7);
    doc.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin, "S");
  }

  const pdfBuf = doc.output("arraybuffer");
  return new NextResponse(Buffer.from(pdfBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sub-contractor-invoice-${invoice.invoiceNumber || id}.pdf"`,
    },
  });
}
