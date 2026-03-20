import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

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

// GET /api/vendors/export
// Returns Excel export of vendors list, respecting search, sort, and order
export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.EXPORT_VENDORS]);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "vendorName").toString();
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.vendorName = { contains: search };
    }

    const sortableFields = new Set(["vendorName", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) 
      ? { [sort]: order } 
      : { vendorName: "asc" };

    const rows = await prisma.vendor.findMany({
      where,
      include: {
        state: { select: { state: true } },
        city: { select: { city: true } },
        itemCategories: {
          select: {
            itemCategory: { select: { itemCategory: true } }
          }
        },
        bankAccounts: true
      },
      orderBy,
      take: 100000,
    });

    const exportedAt = new Date();

    const wsData: any[][] = [];
    wsData.push(["Vendors Export"]);
    wsData.push([`Exported At: ${formatExportedAt(exportedAt)}`]);
    wsData.push(["Applied Filters"]);
    wsData.push(["Search", search || "All"]);
    wsData.push(["Sort", sort]);
    wsData.push(["Order", order]);
    wsData.push([]);

    const headers = [
      "Vendor Name",
      "Contact Person",
      "Address Line 1",
      "Address Line 2",
      "State",
      "City",
      "Pincode",
      "Mobile 1",
      "Mobile 2",
      "Email",
      "Alternate Email 1",
      "Alternate Email 2",
      "Alternate Email 3",
      "Alternate Email 4",
      "Landline 1",
      "Landline 2",
      "Bank",
      "Branch",
      "Branch Code",
      "Account Number",
      "IFSC Code",
      "PAN Number",
      "VAT TIN Number",
      "CST TIN Number",
      "GST Number",
      "CIN Number",
      "Service Tax Number",
      "State Code",
      "Categories",
      "Bank Accounts (Count)",
      "Created At",
      "Updated At"
    ];

    const headerRowIndex = wsData.length;
    wsData.push(headers);

    for (const r of rows) {
      const categories = r.itemCategories
        ?.map((ic) => ic.itemCategory?.itemCategory)
        .filter(Boolean)
        .join(", ");
        
      const bankAccountsStr = r.bankAccounts?.length > 0 
        ? `${r.bankAccounts.length}` 
        : "0";

      const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB") : "";
      const updatedAt = r.updatedAt ? new Date(r.updatedAt).toLocaleString("en-GB") : "";

      wsData.push([
        r.vendorName || "-",
        r.contactPerson || "-",
        r.addressLine1 || "-",
        r.addressLine2 || "-",
        r.state?.state || "-",
        r.city?.city || "-",
        r.pincode || "-",
        r.mobile1 || "-",
        r.mobile2 || "-",
        r.email || "-",
        r.alternateEmail1 || "-",
        r.alternateEmail2 || "-",
        r.alternateEmail3 || "-",
        r.alternateEmail4 || "-",
        r.landline1 || "-",
        r.landline2 || "-",
        r.bank || "-",
        r.branch || "-",
        r.branchCode || "-",
        r.accountNumber || "-",
        r.ifscCode || "-",
        r.panNumber || "-",
        r.vatTinNumber || "-",
        r.cstTinNumber || "-",
        r.gstNumber || "-",
        r.cinNumber || "-",
        r.serviceTaxNumber || "-",
        r.stateCode || "-",
        categories || "-",
        bankAccountsStr,
        createdAt,
        updatedAt
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto size standard columns, headers length as reference bounds
    const cols = headers.map((h, i) => {
      // standard wide columns
      if ([0, 2, 3, 9, 28].includes(i)) return { wch: 30 };
      // email cols
      if ([10, 11, 12, 13].includes(i)) return { wch: 25 };
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
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: thinBorder(),
    } as any;

    const range = XLSX.utils.decode_range(ws["!ref"] || `A1:AF1`);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        if (r === 0) {
          cell.s = titleStyle;
          continue;
        }
        if (r >= 2 && r <= 5 && c === 0) {
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
    XLSX.utils.book_append_sheet(wb, ws, "Vendors");

    const buffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
      cellStyles: true,
    });

    const dateStr = exportedAt.toISOString().slice(0, 10);
    const filename = `vendors_${dateStr}.xlsx`;

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
    console.error("Export vendors error:", error);
    return NextResponse.json({ message: "Failed to export vendors" }, { status: 500 });
  }
}
