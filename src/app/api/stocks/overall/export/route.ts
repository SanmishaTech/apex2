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

// GET /api/stocks/overall/export
// Returns Excel export of overall stock per site-item, respecting the same filters as /api/stocks/overall
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const siteIdParam = searchParams.get("siteId");
    const itemIdParam = searchParams.get("itemId");
    const sort = (searchParams.get("sort") || "site").toString();
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const siteId = siteIdParam ? Number(siteIdParam) : undefined;
    const itemId = itemIdParam ? Number(itemIdParam) : undefined;

    const where: any = {};

    // Restrict to assigned sites for non-admin users
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      if (Number.isFinite(siteId as number)) {
        const sid = siteId as number;
        where.siteId = { in: assignedSiteIds.includes(sid) ? [sid] : [-1] };
      } else {
        where.siteId = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
      }
    } else {
      if (Number.isFinite(siteId as number)) where.siteId = siteId;
    }

    if (Number.isFinite(itemId as number)) where.itemId = itemId;

    if (search) {
      where.OR = [
        { site: { site: { contains: search, mode: "insensitive" } } },
        { item: { item: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Sorting mapping (match /api/stocks/overall)
    const orderBy: any[] = [];
    if (sort === "site") orderBy.push({ site: { site: order } });
    else if (sort === "item") orderBy.push({ item: { item: order } });
    else if (sort === "unit") orderBy.push({ item: { unit: { unitName: order } } });
    else if (sort === "openingQty") orderBy.push({ openingStock: order });
    else if (sort === "closingQty") orderBy.push({ closingStock: order });
    else orderBy.push({ site: { site: "asc" } }, { item: { item: "asc" } });

    const rows = await prisma.siteItem.findMany({
      where,
      select: {
        siteId: true,
        itemId: true,
        openingStock: true,
        closingStock: true,
        site: { select: { site: true } },
        item: { select: { item: true, unit: { select: { unitName: true } } } },
      },
      orderBy: orderBy.length ? orderBy : undefined,
      take: 100000,
    });

    const exportedAt = new Date();
    const siteName = siteId
      ? (await prisma.site.findUnique({ where: { id: siteId }, select: { site: true } }))
          ?.site || String(siteId)
      : "All";
    const itemName = itemId
      ? (await prisma.item.findUnique({ where: { id: itemId }, select: { item: true } }))
          ?.item || String(itemId)
      : "All";

    const wsData: any[][] = [];
    wsData.push(["Overall Stock Export"]);
    wsData.push([`Exported At: ${formatExportedAt(exportedAt)}`]);
    wsData.push(["Applied Filters"]);
    wsData.push(["Search", search || "All"]);
    wsData.push(["Site", siteName]);
    wsData.push(["Item", itemName]);
    wsData.push(["Sort", sort || "site"]);
    wsData.push(["Order", order || "asc"]);
    wsData.push([]);

    const headerRowIndex = wsData.length;
    wsData.push(["Site", "Item", "Unit", "Opening Qty", "Closing Qty"]);

    for (const r of rows) {
      wsData.push([
        r.site?.site || "-",
        r.item?.item || "",
        r.item?.unit?.unitName || "",
        Number(r.openingStock || 0),
        Number(r.closingStock || 0),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 30 },
      { wch: 40 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
    ];

    const maxCol = 4;
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
      alignment: { horizontal: "left", vertical: "center" },
      border: thinBorder(),
    } as any;

    const numStyle = {
      alignment: { horizontal: "right", vertical: "center" },
      border: thinBorder(),
      numFmt: "0.0000",
    } as any;

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:E1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        if (r === 0) {
          cell.s = titleStyle;
          continue;
        }
        if (r >= 3 && r <= 7 && c === 0) {
          cell.s = metaLabelStyle;
          continue;
        }
        if (r === headerRowIndex) {
          cell.s = headerStyle;
          continue;
        }
        if (r > headerRowIndex) {
          if (c === 3 || c === 4) cell.s = numStyle;
          else cell.s = cellStyle;
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Overall Stock");

    const buffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
      cellStyles: true,
    });

    const dateStr = exportedAt.toISOString().slice(0, 10);
    const filename = `overall_stock_${dateStr}.xlsx`;

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
    console.error("Export overall stock error:", error);
    return NextResponse.json({ message: "Failed to export overall stock" }, { status: 500 });
  }
}
