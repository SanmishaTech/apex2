import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS, ROLES } from "@/config/roles";

function formatExportedAt(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min} ${ampm}`;
}

function thinBorder() {
  return {
    top: { style: "thin", color: { rgb: "FF9CA3AF" } },
    bottom: { style: "thin", color: { rgb: "FF9CA3AF" } },
    left: { style: "thin", color: { rgb: "FF9CA3AF" } },
    right: { style: "thin", color: { rgb: "FF9CA3AF" } },
  } as any;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.EXPORT_PURCHASE_ORDERS]);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const siteFilter = searchParams.get("site") || "";
    const vendorFilter = searchParams.get("vendor") || "";
    const approvalStatusFilter = searchParams.get("approvalStatus") || "";
    const poStatusFilter = searchParams.get("poStatus") || "";
    const sort = (searchParams.get("sort") || "purchaseOrderDate").toString();
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc");

    const where: any = {};

    if (search) {
      where.OR = [
        { purchaseOrderNo: { contains: search } },
        { quotationNo: { contains: search } },
        { note: { contains: search } },
      ];
    }

    const role = auth.user.role;
    const isPrivileged = role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    let assignedSiteIds: number[] | null = null;
    
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      assignedSiteIds = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      if (!siteFilter && (!assignedSiteIds || assignedSiteIds.length === 0)) {
        return NextResponse.json({ message: "No assigned sites" }, { status: 403 });
      }
    }

    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        if (!isPrivileged && assignedSiteIds) {
          if (!assignedSiteIds.includes(siteId)) {
            return NextResponse.json({ message: "Forbidden site" }, { status: 403 });
          }
        }
        where.siteId = siteId;
      }
    } else if (!isPrivileged && assignedSiteIds && assignedSiteIds.length > 0) {
      where.siteId = { in: assignedSiteIds };
    }

    if (vendorFilter) {
      const vendorId = parseInt(vendorFilter);
      if (!isNaN(vendorId)) {
        where.vendorId = vendorId;
      }
    }

    if (approvalStatusFilter) {
      const allowed = new Set(["DRAFT", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2", "COMPLETED", "SUSPENDED"]);
      if (allowed.has(approvalStatusFilter)) {
        where.approvalStatus = approvalStatusFilter;
      }
    }

    if (poStatusFilter) {
      const allowed = new Set(["OPEN", "ORDER_PLACED", "IN_TRANSIT", "RECEIVED", "HOLD"]);
      if (allowed.has(poStatusFilter)) {
        where.poStatus = poStatusFilter;
      }
    }

    const sortableFields = new Set([
      "purchaseOrderNo",
      "purchaseOrderDate",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { purchaseOrderDate: "desc" };

    const rows = await prisma.purchaseOrder.findMany({
      where,
      orderBy,
      take: 100000,
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
        approvalStatus: true,
        poStatus: true,
        billStatus: true,
        remarks: true,
        site: { select: { site: true, siteCode: true } },
        vendor: { select: { vendorName: true } },
        billingAddress: { select: { companyName: true, city: true } },
        siteDeliveryAddress: { select: { addressLine1: true, addressLine2: true, cityId: true, stateId: true, pinCode: true } },
        createdBy: { select: { name: true } },
        approved1By: { select: { name: true } },
        approved2By: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
        purchaseOrderDetails: {
          select: {
            serialNo: true,
            item: { select: { itemCode: true, item: true } },
            qty: true,
            orderedQty: true,
            approved1Qty: true,
            approved2Qty: true,
            receivedQty: true,
            rate: true,
            discountPercent: true,
            disAmt: true,
            tax: true,
            taxAmt: true,
            cgstPercent: true,
            cgstAmt: true,
            sgstPercent: true,
            sgstAmt: true,
            igstPercent: true,
            igstAmt: true,
            amount: true,
            remark: true,
          },
          orderBy: { serialNo: 'asc' }
        },
        poPaymentTerms: {
          select: {
            paymentTerm: { select: { paymentTerm: true, description: true } }
          }
        },
        poAdditionalCharge: {
          select: {
            head: true,
            gstCharge: true,
            amount: true,
            amountWithGst: true,
          },
          orderBy: { id: 'asc' }
        }
      }
    });

    const exportedAt = new Date();

    const wsData: any[][] = [];
    wsData.push(["Purchase Orders Export"]);
    wsData.push([`Exported At: ${formatExportedAt(exportedAt)}`]);
    wsData.push(["Applied Filters"]);
    wsData.push(["Search", search || "All"]);
    wsData.push(["Site", siteFilter || "All"]);
    wsData.push(["Vendor", vendorFilter || "All"]);
    wsData.push(["Approval Status", approvalStatusFilter || "All"]);
    wsData.push(["PO Status", poStatusFilter || "All"]);
    wsData.push(["Sort", sort]);
    wsData.push(["Order", order]);
    wsData.push([]);

    const headers = [
      "PO No.",
      "PO Date",
      "Delivery Date",
      "Site",
      "Vendor",
      "Amount",
      "Amount in Words",
      "Approval Status",
      "PO Status",
      "Bill Status",
      "Created By",
      "Approve 1 By",
      "Approve 2 By",
      "Quotation No",
      "Quotation Date",
      "Transport",
      "Note",
      "Terms",
      "Delivery Schedule",
      "Total CGST",
      "Total SGST",
      "Total IGST",
      "Items",
      "Payment Terms",
      "Additional Charges",
      "Created At",
      "Updated At"
    ];

    const headerRowIndex = wsData.length;
    wsData.push(headers);

    for (const r of rows) {
      // Format Items: 1), 2), 3) with full details
      const itemsStr = r.purchaseOrderDetails?.map((detail, index) => {
        let str = `${index + 1}) ${detail.item?.item || "Unknown"}`;
        if (detail.item?.itemCode) str += ` (${detail.item.itemCode})`;
        const parts: string[] = [];
        if (detail.qty) parts.push(`Qty: ${Number(detail.qty)}`);
        if (detail.orderedQty) parts.push(`Ordered Qty: ${Number(detail.orderedQty)}`);
        if (detail.approved1Qty) parts.push(`App1 Qty: ${Number(detail.approved1Qty)}`);
        if (detail.approved2Qty) parts.push(`App2 Qty: ${Number(detail.approved2Qty)}`);
        if (detail.receivedQty) parts.push(`Recv Qty: ${Number(detail.receivedQty)}`);
        if (detail.rate) parts.push(`Rate: ${Number(detail.rate)}`);
        if (detail.discountPercent && Number(detail.discountPercent) > 0) parts.push(`Disc%: ${Number(detail.discountPercent)}`);
        if (detail.disAmt && Number(detail.disAmt) > 0) parts.push(`Disc Amt: ${Number(detail.disAmt)}`);
        if (detail.tax && Number(detail.tax) > 0) parts.push(`Tax: ${Number(detail.tax)}`);
        if (detail.taxAmt && Number(detail.taxAmt) > 0) parts.push(`Tax Amt: ${Number(detail.taxAmt)}`);
        if (detail.cgstPercent && Number(detail.cgstPercent) > 0) parts.push(`CGST%: ${Number(detail.cgstPercent)}`);
        if (detail.cgstAmt && Number(detail.cgstAmt) > 0) parts.push(`CGST Amt: ${Number(detail.cgstAmt)}`);
        if (detail.sgstPercent && Number(detail.sgstPercent) > 0) parts.push(`SGST%: ${Number(detail.sgstPercent)}`);
        if (detail.sgstAmt && Number(detail.sgstAmt) > 0) parts.push(`SGST Amt: ${Number(detail.sgstAmt)}`);
        if (detail.igstPercent && Number(detail.igstPercent) > 0) parts.push(`IGST%: ${Number(detail.igstPercent)}`);
        if (detail.igstAmt && Number(detail.igstAmt) > 0) parts.push(`IGST Amt: ${Number(detail.igstAmt)}`);
        if (detail.amount) parts.push(`Amt: ${Number(detail.amount)}`);
        if (detail.remark) parts.push(`Remark: ${detail.remark}`);
        
        return str + (parts.length > 0 ? ` [${parts.join(", ")}]` : "");
      }).join("\n") || "-";

      // Format payment terms: 1), 2), 3) with numbering
      const paymentTermsStr = r.poPaymentTerms?.map((pt, index) => {
        const term = pt.paymentTerm?.paymentTerm || "";
        const desc = pt.paymentTerm?.description || "";
        return `${index + 1}) ${term}${desc ? ` - ${desc}` : ""}`;
      }).join("\n") || "-";

      // Format additional charges: 1), 2), 3)
      const chargesStr = r.poAdditionalCharge?.map((c, index) => {
        return `${index + 1}) ${c.head} (GST: ${c.gstCharge}, Amt: ${Number(c.amount || 0)}, Total: ${Number(c.amountWithGst || 0)})`;
      }).join("\n") || "-";

      const poDate = r.purchaseOrderDate ? new Date(r.purchaseOrderDate).toLocaleDateString("en-GB") : "-";
      const deliveryDate = r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString("en-GB") : "-";
      const quotationDate = r.quotationDate ? new Date(r.quotationDate).toLocaleDateString("en-GB") : "-";
      const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB") : "-";
      const updatedAt = r.updatedAt ? new Date(r.updatedAt).toLocaleString("en-GB") : "-";

      wsData.push([
        r.purchaseOrderNo || "-",
        poDate,
        deliveryDate,
        r.site?.site || "-",
        r.vendor?.vendorName || "-",
        Number(r.amount || 0),
        r.amountInWords || "-",
        r.approvalStatus || "-",
        r.poStatus || "-",
        r.billStatus || "-",
        r.createdBy?.name || "-",
        r.approved1By?.name || "-",
        r.approved2By?.name || "-",
        r.quotationNo || "-",
        quotationDate,
        r.transport || "-",
        r.note || "-",
        r.terms || "-",
        r.deliverySchedule || "-",
        Number(r.totalCgstAmount || 0),
        Number(r.totalSgstAmount || 0),
        Number(r.totalIgstAmount || 0),
        itemsStr,
        paymentTermsStr,
        chargesStr,
        createdAt,
        updatedAt,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto size standard columns, with large width for multiline texts
    const cols = headers.map((h, i) => {
      if (h === "Items") return { wch: 100 }; // Very wide for items with many fields inline
      if (h === "Note" || h === "Terms" || h === "Payment Terms" || h === "Additional Charges") return { wch: 45 };
      if ([0, 3, 4, 6].includes(i)) return { wch: 25 }; // Text identifiers
      return { wch: Math.max(15, h.length + 2) };
    });
    ws["!cols"] = cols;

    const maxCol = headers.length - 1;
    if (!ws["!merges"]) ws["!merges"] = [];
    const merges = ws["!merges"] as any[];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: maxCol } });

    const titleStyle = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: "center", vertical: "center" },
    } as any;

    const metaLabelStyle = {
      font: { bold: true },
      alignment: { horizontal: "left", vertical: "center" },
    } as any;

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "FF2563EB" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder(),
    } as any;

    const cellStyle = {
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: thinBorder(),
    } as any;

    const range = XLSX.utils.decode_range(ws["!ref"] || `A1:AG1`); 
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        if (r === 0) {
          cell.s = titleStyle;
          continue;
        }
        if (r >= 2 && r <= 8 && c === 0) {
          cell.s = metaLabelStyle;
          continue;
        }
        if (r === headerRowIndex) {
          cell.s = headerStyle;
          continue;
        }
        if (r > headerRowIndex) {
          cell.s = cellStyle;
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Orders");

    const buffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
      cellStyles: true,
    });

    const dateStr = exportedAt.toISOString().slice(0, 10);
    const filename = `purchase_orders_${dateStr}.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export purchase orders error:", error);
    return NextResponse.json({ message: "Failed to export purchase orders" }, { status: 500 });
  }
}
