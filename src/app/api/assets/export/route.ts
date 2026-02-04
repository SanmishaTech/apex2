import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

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

function parseCsvStrings(param: string | null) {
  return (param || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseCsvNumbers(param: string | null) {
  return parseCsvStrings(param)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
}

// GET /api/assets/export
// Returns Excel export of assets list, respecting the same filters as /api/assets (including multi-select CSV params)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const statusValues = parseCsvStrings(searchParams.get("status"));
    const assetGroupIds = parseCsvNumbers(searchParams.get("assetGroupId"));
    const currentSiteIds = parseCsvNumbers(searchParams.get("currentSiteId"));
    const sort = (searchParams.get("sort") || "createdAt").toString();
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { assetNo: { contains: search } },
        { assetName: { contains: search } },
        { make: { contains: search } },
        { supplier: { contains: search } },
        { invoiceNo: { contains: search } },
        { assetGroup: { assetGroupName: { contains: search } } },
        { assetCategory: { category: { contains: search } } },
      ];
    }

    if (statusValues.length === 1) where.status = statusValues[0];
    else if (statusValues.length > 1) where.status = { in: statusValues };

    if (assetGroupIds.length === 1) where.assetGroupId = assetGroupIds[0];
    else if (assetGroupIds.length > 1) where.assetGroupId = { in: assetGroupIds };

    if (currentSiteIds.length === 1) where.currentSiteId = currentSiteIds[0];
    else if (currentSiteIds.length > 1) where.currentSiteId = { in: currentSiteIds };

    // Site-based visibility: only ADMIN can see all; others limited to assigned sites
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      const inIds = assignedSiteIds.length > 0 ? assignedSiteIds : [-1];

      if (currentSiteIds.length > 0) {
        const allowed = currentSiteIds.filter((id) => inIds.includes(id));
        where.currentSiteId = { in: allowed.length > 0 ? allowed : [-1] };
      } else {
        where.currentSiteId = { in: inIds };
      }
    }

    const orderBy: any = {};
    orderBy[sort] = order;

    const rows = await prisma.asset.findMany({
      where,
      select: {
        assetNo: true,
        assetName: true,
        make: true,
        description: true,
        status: true,
        useStatus: true,
        supplier: true,
        invoiceNo: true,
        purchaseDate: true,
        nextMaintenanceDate: true,
        assetGroup: { select: { assetGroupName: true } },
        assetCategory: { select: { category: true } },
        currentSite: { select: { site: true } },
        createdAt: true,
      },
      orderBy,
      take: 100000,
    });

    const exportedAt = new Date();

    const statusLabel = statusValues.length ? statusValues.join(", ") : "All";

    const sitesLabel = currentSiteIds.length
      ? (
          await prisma.site.findMany({
            where: { id: { in: currentSiteIds } },
            select: { site: true },
            orderBy: { site: "asc" },
            take: 1000,
          })
        )
          .map((s) => s.site)
          .filter(Boolean)
          .join(", ") || currentSiteIds.join(", ")
      : "All";

    const assetGroupLabel = assetGroupIds.length
      ? (
          await prisma.assetGroup.findMany({
            where: { id: { in: assetGroupIds } },
            select: { assetGroupName: true },
            orderBy: { assetGroupName: "asc" },
            take: 1000,
          })
        )
          .map((g) => g.assetGroupName)
          .filter(Boolean)
          .join(", ") || assetGroupIds.join(", ")
      : "All";

    const wsData: any[][] = [];
    wsData.push(["Assets Export"]);
    wsData.push([`Exported At: ${formatExportedAt(exportedAt)}`]);
    wsData.push(["Applied Filters"]);
    wsData.push(["Search", search || "All"]);
    wsData.push(["Status", statusLabel]);
    wsData.push(["Asset Group", assetGroupLabel]);
    wsData.push(["Sites", sitesLabel]);
    wsData.push(["Sort", sort]);
    wsData.push(["Order", order]);
    wsData.push([]);

    const headerRowIndex = wsData.length;
    wsData.push([
      "Asset No",
      "Asset Name",
      "Make",
      "Asset Group",
      "Asset Category",
      "Site",
      "Status",
      "Use Status",
      "Supplier",
      "Invoice No",
      "Purchase Date",
      "Next Maintenance",
      "Created At",
    ]);

    for (const r of rows) {
      const purchaseDate = r.purchaseDate
        ? new Date(r.purchaseDate).toLocaleDateString("en-GB")
        : "";
      const nextMaint = r.nextMaintenanceDate
        ? new Date(r.nextMaintenanceDate).toLocaleDateString("en-GB")
        : "";
      const createdAt = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString("en-GB")
        : "";

      wsData.push([
        r.assetNo || "",
        r.assetName || "",
        r.make || "",
        r.assetGroup?.assetGroupName || "",
        r.assetCategory?.category || "",
        r.currentSite?.site || "",
        r.status || "",
        r.useStatus || "",
        r.supplier || "",
        r.invoiceNo || "",
        purchaseDate,
        nextMaint,
        createdAt,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 22 },
      { wch: 20 },
      { wch: 26 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
    ];

    const maxCol = 12;
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

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:M1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        if (r === 0) {
          cell.s = titleStyle;
          continue;
        }
        if (r >= 3 && r <= 8 && c === 0) {
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
    XLSX.utils.book_append_sheet(wb, ws, "Assets");

    const buffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
      cellStyles: true,
    });

    const dateStr = exportedAt.toISOString().slice(0, 10);
    const filename = `assets_${dateStr}.xlsx`;

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
    console.error("Export assets error:", error);
    return NextResponse.json({ message: "Failed to export assets" }, { status: 500 });
  }
}
