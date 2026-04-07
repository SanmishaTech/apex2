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

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setTextColor(0);
  doc.setDrawColor(0);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;

  const logo = await loadLogoDataUrl(((swo as any).site as any)?.company?.logoUrl);
  if (logo) {
    try {
      // place larger logo at top-right
      const logoW = 55;
      const logoH = 22;
      const logoX = pageWidth - margin - logoW;
      const logoY = 10;
      doc.addImage(logo.dataUrl, logo.format, logoX, logoY, logoW, logoH);
    } catch (e) {}
  }

  // Title - positioned below logo with padding
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Sub Contractor Work Order", pageWidth / 2, 38, { align: "center" } as any);

  // set global smaller font for print
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // We'll render vendor / WO details using a 2-column table below
  let y = 45;
  // Two-column table after heading: vendor / title & WO details  (2 rows)
  const vendorTextLines = [] as string[];
  vendorTextLines.push('To,');
  vendorTextLines.push(swo.vendor?.vendorName || 'M/s -');
  if (swo.vendor?.addressLine1) vendorTextLines.push(swo.vendor.addressLine1);
  if (swo.vendor?.addressLine2) vendorTextLines.push(swo.vendor.addressLine2);
  const vendorCity = swo.vendor?.city?.city ? `${swo.vendor.city.city}` : '';
  const vendorState = swo.vendor?.state?.state ? `${swo.vendor.state.state}` : '';
  const vendorPin = swo.vendor?.pincode ? swo.vendor.pincode : '';
  if (vendorCity || vendorPin || vendorState) vendorTextLines.push(`${vendorCity} - ${vendorPin}, ${vendorState}`);
  vendorTextLines.push(`Contact Person : ${swo.vendor?.contactPerson || '-'}`);
  vendorTextLines.push(`Mobile No : ${swo.vendor?.mobile1 || '-'}`);
  vendorTextLines.push(`Email Id : ${swo.vendor?.email || '-'}`);
  vendorTextLines.push(`GST No : ${swo.vendor?.gstNumber || ' / State Code'}`);

  const rightTopLines = [] as string[];
  rightTopLines.push('SUB CONTRACTOR WORK ORDER - Sub');
  rightTopLines.push('Contract');
  rightTopLines.push('');
  rightTopLines.push(`W O Number : ${swo.workOrderNo || '-'}`);
  rightTopLines.push(`BOQ Number : ${swo.quotationNo || '-'}`);
  rightTopLines.push(`Date : ${formatDateSafe(swo.workOrderDate)}`);
  rightTopLines.push(`Quotation No : ${swo.quotationNo || '-'}`);
  rightTopLines.push(`Quotation Date : ${formatDateSafe(swo.quotationDate)}`);

  const billingLines = [] as string[];
  billingLines.push('Billing Address');
  billingLines.push(swo.billingAddress?.companyName || '-');
  if (swo.billingAddress?.addressLine1) billingLines.push(swo.billingAddress.addressLine1);
  if (swo.billingAddress?.addressLine2) billingLines.push(swo.billingAddress.addressLine2);
  const billingCity = swo.billingAddress?.city?.city ? `${swo.billingAddress.city.city}` : '';
  const billingState = swo.billingAddress?.state?.state ? `${swo.billingAddress.state.state}` : '';
  const billingPin = swo.billingAddress?.pincode ? swo.billingAddress.pincode : '';
  if (billingCity || billingPin || billingState) billingLines.push(`${billingCity} - ${billingPin} ${billingState}.`);
  billingLines.push(`Email Id : ${swo.billingAddress?.addressLine1 ? swo.billingAddress.addressLine1 : '-'}`);
  billingLines.push('GST No :');
  billingLines.push('State Code :');
  billingLines.push('CIN No :');

  const deliveryLines = [] as string[];
  deliveryLines.push('Deliver To:');
  if (swo.deliveryAddress?.addressLine1) deliveryLines.push(swo.deliveryAddress.addressLine1);
  if (swo.deliveryAddress?.addressLine2) deliveryLines.push(swo.deliveryAddress.addressLine2);
  const delCity = swo.deliveryAddress?.city?.city ? `${swo.deliveryAddress.city.city}` : '';
  const delState = swo.deliveryAddress?.state?.state ? `${swo.deliveryAddress.state.state}` : '';
  const delPin = swo.deliveryAddress?.pinCode ? swo.deliveryAddress.pinCode : '';
  if (delCity || delPin || delState) deliveryLines.push(`${delCity} - ${delPin}, ${delState}`);

  (autoTable as any)(doc as any, {
    startY: y,
    body: [
      [ { content: vendorTextLines.join('\n') }, { content: rightTopLines.join('\n') } ],
      [ { content: billingLines.join('\n') }, { content: deliveryLines.join('\n') } ],
    ],
    styles: { fontSize: 10, textColor: 0 },
    theme: 'grid',
    head: [],
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: pageWidth / 2 - margin }, 1: { cellWidth: pageWidth / 2 - margin } },
  });

  // Intro paragraph requested by user (hardcoded)
  const intro = `Dear Sir/Madam :\nWe are pleased to confirm our work order against your Quotation. You are requested to execute the following items as per terms and conditions attached. Please quote work order no in challan,invoice and related correspondence.`;
  // wrap text manually to fit page width
  const maxTextWidth = pageWidth - margin * 2;
  const lines = (doc as any).splitTextToSize(intro, maxTextWidth - 4);
  
  // Ensure intro starts after the header table with proper spacing
  const headerTableEndY = (doc as any).lastAutoTable?.finalY || y + 50;
  const introStartY = headerTableEndY + 8;
  
  doc.setFontSize(9);
  doc.text(lines, margin, introStartY);

  // move startY below intro with padding
  let itemsStartY = introStartY + lines.length * 3.5 + 6;

  // Build items table with tax sub-columns: CGST(% / Amt), SGST(% / Amt), IGST(% / Amt)
  const details = swo.subContractorWorkOrderDetails || [];
  const itemsBody = details.map((it: any, idx: number) => {
    const qty = Number(it.qty ?? 0);
    const rate = Number(it.rate ?? 0);
    const base = qty * rate || 0;

    const cgstAmt = Number(it.cgstAmt ?? 0);
    const sgstAmt = Number(it.sgstAmt ?? 0);
    const igstAmt = Number(it.igstAmt ?? 0);

    const cgstPct = base > 0 ? (cgstAmt / base) * 100 : NaN;
    const sgstPct = base > 0 ? (sgstAmt / base) * 100 : NaN;
    const igstPct = base > 0 ? (igstAmt / base) * 100 : NaN;

    return [
      String(idx + 1), // sr.no
      String(it.id ?? "-"), // activity id
      it.item || "-", // description
      it.sacCode || "-",
      it.qty != null ? Number(it.qty).toLocaleString("en-IN") : "-",
      it.unit?.unitName || "-",
      formatCurrency(it.rate),
      // CGST % , CGST amount
      Number.isFinite(cgstPct) ? `${cgstPct.toFixed(2)}%` : "-",
      formatCurrency(cgstAmt),
      // SGST % , SGST amount
  Number.isFinite(sgstPct) ? `${sgstPct.toFixed(2)}%` : "-",
      formatCurrency(sgstAmt),
      // IGST % , IGST amount
      Number.isFinite(igstPct) ? `${igstPct.toFixed(2)}%` : "-",
      formatCurrency(igstAmt),
      // Amount
      formatCurrency(it.amount),
    ];
  });

  (autoTable as any)(doc as any, {
    startY: itemsStartY,
    tableWidth: pageWidth - margin * 2,
    head: [
      [
        { content: 'Sr.\nNo', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Activity\nID', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Description', rowSpan: 2, styles: { halign: 'left', valign: 'middle', fontSize: 7 } },
        { content: 'SAC\nCode', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Qty', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Unit', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Rate', rowSpan: 2, styles: { halign: 'right', valign: 'middle', fontSize: 7 } },
        { content: 'CGST', colSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'SGST', colSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'IGST', colSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Amount', rowSpan: 2, styles: { halign: 'right', valign: 'middle', fontSize: 7 } },
      ],
      [
        '', '', '', '', '', '', '',
        { content: '%', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Amt', styles: { halign: 'right', valign: 'middle', fontSize: 7 } },
        { content: '%', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Amt', styles: { halign: 'right', valign: 'middle', fontSize: 7 } },
        { content: '%', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
        { content: 'Amt', styles: { halign: 'right', valign: 'middle', fontSize: 7 } },
        ''
      ],
    ],
    body: itemsBody,
    styles: { fontSize: 7, textColor: 0, lineColor: 0, cellPadding: 1 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineWidth: 0.2, halign: 'center', valign: 'middle' },
    theme: 'grid',
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 50, halign: 'left' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 12, halign: 'right' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 10, halign: 'center' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 10, halign: 'center' },
      10: { cellWidth: 14, halign: 'right' },
      11: { cellWidth: 10, halign: 'center' },
      12: { cellWidth: 14, halign: 'right' },
      13: { cellWidth: 16, halign: 'right' },
    },
  });

  const afterItemsY = (doc as any).lastAutoTable?.finalY || itemsStartY + 40;

  const finalY = (doc as any).lastAutoTable?.finalY || (y + 40);

  // (Totals are shown in the attached 4-column table below - do not duplicate here)

  // Attached info table (4 columns): [label, value, spacer, totals column header/value]
  const leftTableStartY = afterItemsY + 40;
  const leftTableBody: any[] = [];

  // Rows where column 0 = label, col1 = value, col2 = tax label, col3 = tax value
  leftTableBody.push([
    { content: 'Delivery Schedule:', styles: { valign: 'top' } },
    formatDateSafe(swo.deliveryDate),
    { content: 'Taxable Amount', styles: { halign: 'center', valign: 'middle' } },
    formatCurrency(swo.totalAmount ?? 0),
  ]);
  leftTableBody.push([
    { content: 'Payment Terms:', styles: { valign: 'top' } },
    swo.paymentTermsInDays != null ? `${swo.paymentTermsInDays} DAYS` : '-',
    { content: 'Total CGST', styles: { halign: 'center', valign: 'middle' } },
    formatCurrency(swo.totalCgst ?? 0),
  ]);
  leftTableBody.push([
    { content: 'Validity:', styles: { valign: 'top' } },
    // hardcoded validity text per request
    'If you have any query, please revert within 48 hours, else we will presume that order is accepted by you.',
    { content: 'Total SGST', styles: { halign: 'center', valign: 'middle' } },
    formatCurrency(swo.totalSgst ?? 0),
  ]);
  leftTableBody.push([
    { content: 'Jurisdiction & Conditions:', styles: { valign: 'top' } },
    // hardcoded jurisdiction text per request
    'Mumbai Courts, please refer the general terms and conditions governing this PO.',
    { content: 'Total IGST', styles: { halign: 'center', valign: 'middle' } },
    formatCurrency(swo.totalIgst ?? 0),
  ]);
  leftTableBody.push([
    { content: 'Note:', styles: { valign: 'top' } },
    swo.note || '-',
    { content: '', styles: { valign: 'top' } },
    { content: '', styles: { valign: 'top' } },
  ]);

  // one more row with 3 columns: amount in words (spans col0-1), 'Total Amount' (col2), value (col3)
  leftTableBody.push([
    { content: swo.amountInWords || '-', colSpan: 2, styles: { valign: 'top' } },
    { content: 'Total Amount', styles: { halign: 'left', valign: 'top' } },
    { content: formatCurrency(swo.totalAmount ?? 0), styles: { halign: 'right', valign: 'top' } },
  ]);

  (autoTable as any)(doc as any, {
    startY: leftTableStartY,
    body: leftTableBody,
    styles: { fontSize: 9, textColor: 0 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0 },
    theme: 'grid',
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: pageWidth / 2 - margin - 45 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
  });
  // Print Terms & Conditions full width below the attached table
  const afterLeftTableY = (doc as any).lastAutoTable?.finalY || leftTableStartY + 40;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text('Terms & Conditions:', margin, afterLeftTableY + 8);
  doc.setFont("helvetica", "normal");
  const termsText = swo.terms || '-';
  const termsLines = (doc as any).splitTextToSize(termsText, pageWidth - margin * 2);
  doc.text(termsLines, margin, afterLeftTableY + 14);

  // Signature lines: Prepared by / Approved by 1 / Approved by 2
  const sigStartY = afterLeftTableY + 14 + termsLines.length * 5 + 12;
  const colW = (pageWidth - margin * 2) / 3;
  const leftX = margin;
  const midX = margin + colW;
  const rightX = margin + colW * 2;
  const sigLineY = sigStartY + 12;
  // draw signature lines
  doc.setLineWidth(0.5);
  doc.setDrawColor(0);
  doc.line(leftX, sigLineY, leftX + colW - 20, sigLineY);
  doc.line(midX, sigLineY, midX + colW - 20, sigLineY);
  doc.line(rightX, sigLineY, rightX + colW - 20, sigLineY);
  // names below lines
  doc.setFont("helvetica", "normal");
  doc.text('Prepared by : Sanjeev Divekar', leftX, sigLineY + 6);
  doc.text('Approved by 1 : Amarnath Sathe', midX, sigLineY + 6);
  doc.text('Approved by 2 : Amarnath Sathe', rightX, sigLineY + 6);

  const watermark = getWatermarkText(swo.status, !!swo.isApproved2);
  if (watermark) applyWatermark(doc, watermark);

  // Draw universal black border on every page (inside margins)
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(0);
    doc.setLineWidth(0.7);
    doc.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin, 'S');
  }

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
