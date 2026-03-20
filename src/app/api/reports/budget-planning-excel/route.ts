import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import * as XLSX from "xlsx-js-style";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_SITE_BUDGETS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  
  const zoneIdRaw = sp.get("zoneId");
  const siteIdsRaw = sp.get("sites");
  const itemIdsRaw = sp.get("items");
  const monthsRaw = sp.get("months");
  const weeksRaw = sp.get("weeks");

  const where: any = {};

  if (zoneIdRaw && !isNaN(Number(zoneIdRaw))) {
    where.site = { ...where.site, zoneId: Number(zoneIdRaw) };
  }

  if (siteIdsRaw) {
    const siteIds = siteIdsRaw.split(",").map(Number).filter(n => !isNaN(n));
    if (siteIds.length > 0) {
      where.siteId = { in: siteIds };
    }
  }

  if (monthsRaw) {
    const months = monthsRaw.split(",").filter(Boolean);
    if (months.length > 0) {
      where.month = { in: months };
    }
  }

  if (weeksRaw) {
    const weeks = weeksRaw.split(",").filter(Boolean);
    if (weeks.length > 0) {
      where.week = { in: weeks };
    }
  }

  let itemFilter = {};
  if (itemIdsRaw) {
    const itemIds = itemIdsRaw.split(",").map(Number).filter(n => !isNaN(n));
    if (itemIds.length > 0) {
      itemFilter = { itemId: { in: itemIds } };
    }
  }

  if (Object.keys(itemFilter).length > 0) {
    where.siteBudgetDetails = {
      some: {
        siteBudgetItems: {
          some: itemFilter
        }
      }
    };
  }

  const budgets = await prisma.siteBudget.findMany({
    where,
    orderBy: [{ id: "asc" }],
    include: {
      site: { select: { site: true, zone: { select: { zoneName: true } } } },
      siteBudgetDetails: {
        include: {
          siteBudgetItems: {
            where: Object.keys(itemFilter).length > 0 ? itemFilter : undefined,
            include: {
              item: { select: { itemCode: true, item: true, unit: { select: { unitName: true } } } },
            },
          },
        },
      },
    },
  });

  const wsData: any[][] = [];
  wsData.push(["Budget Planning Report"]);
  wsData.push([
    "Sr No",
    "Zone",
    "Site",
    "Item Name",
    "Unit",
    "Month",
    "Week",
    "Budget Qty",
    "Budget Rate",
    "Budget Value"
  ]);

  let rowIndex = 1;
  const fmt = (v: number) => Number(v.toFixed(2));

  budgets.forEach(b => {
    (b.siteBudgetDetails || []).forEach(d => {
      (d.siteBudgetItems || []).forEach(it => {
        if (!it.budgetQty || Number(it.budgetQty) <= 0) return;
        
        wsData.push([
          rowIndex++,
          b.site?.zone?.zoneName || "-",
          b.site?.site || "-",
          `${it.item?.itemCode ?? ""}${it.item?.item ? " - " + it.item.item : ""}`.trim(),
          (it as any).item?.unit?.unitName || "-",
          b.month || "-",
          b.week || "-",
          fmt(Number(it.budgetQty || 0)),
          fmt(Number(it.budgetRate || 0)),
          fmt(Number(it.budgetValue || 0)),
        ]);
      });
    });
  });

  if (wsData.length === 2) {
    wsData.push(["No records found matching filters."]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const emeraldHeader = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "059669" } }, // Emerald-600 styling equivalent
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };

  const titleStyle = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
  };

  // Title Row
  if (ws["A1"]) {
    ws["A1"].s = titleStyle;
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });
  }

  // Header row
  for (let c = 0; c < 10; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 1, c });
    const cell = ws[cellRef];
    if (!cell) continue;
    cell.s = { ...(cell.s || {}), ...emeraldHeader };
  }

  // Data rows
  const dataBorderStyle = {
    top: { style: "thin", color: { rgb: "CCCCCC" } },
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
    left: { style: "thin", color: { rgb: "CCCCCC" } },
    right: { style: "thin", color: { rgb: "CCCCCC" } },
  };

  for(let r = 2; r < wsData.length; r++) {
    for(let c = 0; c < 10; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (!cell) continue;
      cell.s = { ...(cell.s || {}), border: dataBorderStyle };
      
      // Numbers formatting mapping equivalent
      if ([0, 7, 8, 9].includes(c) && typeof cell.v === "number") {
        cell.z = "#,##0.00";
        cell.s.alignment = { horizontal: "right" };
      }
    }
  }

  ws["!cols"] = [
    { wch: 8 },  // Sr No
    { wch: 15 }, // Zone
    { wch: 25 }, // Site
    { wch: 35 }, // Item
    { wch: 10 }, // Unit
    { wch: 12 }, // Month
    { wch: 12 }, // Week
    { wch: 15 }, // Qty
    { wch: 15 }, // Rate
    { wch: 15 }, // Value
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Budget Planning Report");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `budget-planning-report-${today}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
