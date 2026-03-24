import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function fmt2(n: number) {
  return Number(n || 0).toFixed(2);
}

function thinBorder() {
  return {
    top: { style: "thin", color: { rgb: "FF9CA3AF" } },
    bottom: { style: "thin", color: { rgb: "FF9CA3AF" } },
    left: { style: "thin", color: { rgb: "FF9CA3AF" } },
    right: { style: "thin", color: { rgb: "FF9CA3AF" } },
  } as any;
}

function formatDdMmYyyyTime(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${sec} ${ampm}`;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_BUDGET_PLANNING_REPORT]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const zoneIdRaw = sp.get("zoneId");
  const siteIdsRaw = sp.get("sites");
  const itemIdsRaw = sp.get("items");
  const monthsRaw = sp.get("months");
  const weeksRaw = sp.get("weeks");

  const siteIds = siteIdsRaw ? siteIdsRaw.split(",").map(Number).filter(n => !isNaN(n)) : [];
  const itemFilterIds = itemIdsRaw ? itemIdsRaw.split(",").map(Number).filter(n => !isNaN(n)) : [];
  const selectedMonths = monthsRaw ? monthsRaw.split(",").filter(Boolean) : [];
  const selectedWeeks = weeksRaw ? weeksRaw.split(",").filter(Boolean) : [];

  const zoneFilter = zoneIdRaw && !isNaN(Number(zoneIdRaw)) ? Number(zoneIdRaw) : undefined;

  const boqWhere: any = {};
  if (siteIds.length > 0) boqWhere.siteId = { in: siteIds };
  if (zoneFilter) boqWhere.site = { zoneId: zoneFilter };

  const overallBudgets = await prisma.overallSiteBudget.findMany({
    where: { boq: boqWhere },
    include: {
      boq: { select: { site: { select: { id: true, site: true, zone: { select: { zoneName: true } } } } } },
      overallSiteBudgetDetails: {
        include: {
          overallSiteBudgetItems: {
            where: itemFilterIds.length > 0 ? { itemId: { in: itemFilterIds } } : undefined,
            include: { item: { select: { id: true, item: true, itemCode: true, unit: { select: { unitName: true } } } } }
          }
        }
      }
    }
  });

  const rowMap = new Map<string, any>(); 

  const getOrCreateRow = (site: any, item: any) => {
    const key = `${site?.id}-${item?.id}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        siteId: site?.id,
        itemId: item?.id,
        zone: site?.zone?.zoneName || "-",
        site: site?.site || "-",
        itemName: `${item?.itemCode ?? ""}${item?.item ? " - " + item.item : ""}`.trim() || "-",
        unit: item?.unit?.unitName || "-",
        totalReqQty: 0,
        totalReqValue: 0,
        closingQty: 0,
        receivedQty: 0,
        monthProps: {} as Record<string, { qty: number, amt: number }>,
        weekProps: {} as Record<string, { qty: number, amt: number }>
      });
    }
    return rowMap.get(key);
  };

  const validSiteIdsSet = new Set<number>();

  for (const b of overallBudgets) {
    if (!b.boq?.site) continue;
    validSiteIdsSet.add(b.boq.site.id);
    for (const d of b.overallSiteBudgetDetails || []) {
      for (const it of d.overallSiteBudgetItems || []) {
        if (!it.item) continue;
        const row = getOrCreateRow(b.boq.site, it.item);
        row.totalReqQty += Number(it.budgetQty || 0);
        row.totalReqValue += Number(it.budgetValue || 0);
      }
    }
  }

  if (siteIds.length > 0) {
    siteIds.forEach(id => validSiteIdsSet.add(id));
  } else if (zoneFilter) {
    const sitesInZone = await prisma.site.findMany({
      where: { zoneId: zoneFilter },
      select: { id: true }
    });
    sitesInZone.forEach(s => validSiteIdsSet.add(s.id));
  }

  const validSiteIds = Array.from(validSiteIdsSet);

  if (validSiteIds.length > 0) {
    const [inwardLots, outwardLots, siteItems] = await Promise.all([
      prisma.inwardDeliveryChallan.findMany({
        where: { siteId: { in: validSiteIds } },
        select: {
          siteId: true,
          inwardDeliveryChallanDetails: {
            select: { receivingQty: true, poDetails: { select: { itemId: true } } }
          }
        }
      }),
      prisma.outwardDeliveryChallan.findMany({
        where: { fromSiteId: { in: validSiteIds }, isAccepted: true },
        select: {
          fromSiteId: true,
          outwardDeliveryChallanDetails: {
            select: { itemId: true, receivedQty: true }
          }
        }
      }),
      prisma.siteItem.findMany({
        where: {
          siteId: { in: validSiteIds },
          itemId: itemFilterIds.length > 0 ? { in: itemFilterIds } : undefined
        },
        include: {
          site: { select: { id: true, site: true, zone: { select: { zoneName: true } } } },
          item: { select: { id: true, item: true, itemCode: true, unit: { select: { unitName: true } } } }
        }
      })
    ]);

    for (const si of siteItems) {
      const row = getOrCreateRow(si.site, si.item);
      row.closingQty = Number(si.closingStock || 0);
    }

    for (const lot of inwardLots) {
      for (const d of lot.inwardDeliveryChallanDetails || []) {
        const itemId = d.poDetails?.itemId;
        if (!itemId) continue;
        if (itemFilterIds.length > 0 && !itemFilterIds.includes(itemId)) continue;
        const key = `${lot.siteId}-${itemId}`;
        if (rowMap.has(key)) {
          rowMap.get(key).receivedQty += Number(d.receivingQty || 0);
        }
      }
    }

    for (const lot of outwardLots) {
      for (const d of lot.outwardDeliveryChallanDetails || []) {
        const itemId = d.itemId;
        if (!itemId) continue;
        if (itemFilterIds.length > 0 && !itemFilterIds.includes(itemId)) continue;
        const key = `${lot.fromSiteId}-${itemId}`;
        if (rowMap.has(key)) {
          rowMap.get(key).receivedQty -= Number(d.receivedQty || 0);
        }
      }
    }

    const sbWhere: any = { siteId: { in: validSiteIds } };
    if (selectedMonths.length > 0 && selectedWeeks.length > 0) {
       sbWhere.OR = [ { month: { in: selectedMonths } }, { week: { in: selectedWeeks } } ];
    } else if (selectedMonths.length > 0) {
       sbWhere.month = { in: selectedMonths };
    } else if (selectedWeeks.length > 0) {
       sbWhere.week = { in: selectedWeeks };
    }

    if (selectedMonths.length > 0 || selectedWeeks.length > 0) {
      const siteBudgets = await prisma.siteBudget.findMany({
        where: sbWhere,
        select: {
          siteId: true,
          month: true,
          week: true,
          siteBudgetDetails: {
            select: {
              siteBudgetItems: {
                where: itemFilterIds.length > 0 ? { itemId: { in: itemFilterIds } } : undefined,
                select: { itemId: true, budgetQty: true, budgetValue: true }
              }
            }
          }
        }
      });

      for (const sb of siteBudgets) {
        for (const d of sb.siteBudgetDetails || []) {
          for (const it of d.siteBudgetItems || []) {
            const itemId = it.itemId;
            const key = `${sb.siteId}-${itemId}`;
            if (!rowMap.has(key)) continue;

            const row = rowMap.get(key);
            const qty = Number(it.budgetQty || 0);
            const amt = Number(it.budgetValue || 0);

            if (sb.month && selectedMonths.includes(sb.month)) {
              if (!row.monthProps[sb.month]) row.monthProps[sb.month] = { qty: 0, amt: 0 };
              row.monthProps[sb.month].qty += qty;
              row.monthProps[sb.month].amt += amt;
            }
            if (sb.week && selectedWeeks.includes(sb.week)) {
              if (!row.weekProps[sb.week]) row.weekProps[sb.week] = { qty: 0, amt: 0 };
              row.weekProps[sb.week].qty += qty;
              row.weekProps[sb.week].amt += amt;
            }
          }
        }
      }
    }
  }

  const outputRows = Array.from(rowMap.values()).map(r => ({
    ...r,
    budgetRate: r.totalReqQty > 0 ? r.totalReqValue / r.totalReqQty : 0,
    balance: Math.max(0, r.totalReqQty - r.receivedQty)
  })).sort((a, b) => a.site.localeCompare(b.site) || a.itemName.localeCompare(b.itemName));

  const wsData: any[][] = [];
  wsData.push(["Budget Planning Report"]);

  const filters: string[] = [];
  if (zoneIdRaw) filters.push(`Zone: ${zoneIdRaw}`);
  if (siteIds.length) filters.push(`Sites: ${siteIds.join(", ")}`);
  if (itemFilterIds.length) filters.push(`Items: ${itemFilterIds.join(", ")}`);
  if (selectedMonths.length) filters.push(`Months: ${selectedMonths.join(", ")}`);
  if (selectedWeeks.length) filters.push(`Weeks: ${selectedWeeks.join(", ")}`);
  
  if (filters.length > 0) {
    wsData.push([`Filters Applied: ${filters.join(" | ")}`]);
  }
  
  wsData.push([`Generated On: ${formatDdMmYyyyTime(new Date())}`]);
  wsData.push([]);

  const colHeaders = ["Sr No", "Zone", "Site", "Item Name", "Unit", "Rate", "Closing Qty", "Total Req. Qty", "Received", "Balance To Be Sent"];
  
  for (const m of selectedMonths) {
    colHeaders.push(`${m} Qty`);
    colHeaders.push(`${m} Amount`);
  }
  for (const w of selectedWeeks) {
    colHeaders.push(`${w} Qty`);
    colHeaders.push(`${w} Amount`);
  }
  wsData.push(colHeaders);

  for (let i = 0; i < outputRows.length; i++) {
    const row = outputRows[i];
    const rowArray: any[] = [
      i + 1,
      row.zone,
      row.site,
      row.itemName,
      row.unit,
      Number(fmt2(row.budgetRate)),
      Number(fmt2(row.closingQty)),
      Number(fmt2(row.totalReqQty)),
      Number(fmt2(row.receivedQty)),
      Number(fmt2(row.balance))
    ];

    for (const m of selectedMonths) {
      rowArray.push(Number(fmt2(row.monthProps[m]?.qty || 0)));
      rowArray.push(Number(fmt2(row.monthProps[m]?.amt || 0)));
    }
    for (const w of selectedWeeks) {
      rowArray.push(Number(fmt2(row.weekProps[w]?.qty || 0)));
      rowArray.push(Number(fmt2(row.weekProps[w]?.amt || 0)));
    }
    wsData.push(rowArray);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const totalCols = colHeaders.length;
  const headerFill = { fgColor: { rgb: "FF059669" } };
  const headerFont = { color: { rgb: "FFFFFFFF" }, bold: true };

  ws["A1"].s = { font: { bold: true, sz: 14 } };

  const startRow = 2; // zero-indexed row 3
  for (let C = 0; C < totalCols; ++C) {
    const cellRef = XLSX.utils.encode_cell({ r: startRow, c: C });
    if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };
    ws[cellRef].s = {
      fill: headerFill,
      font: headerFont,
      alignment: { vertical: "center", horizontal: "center" },
      border: thinBorder(),
    };
  }

  const wscols = [
    { wch: 8 },  // Sr No
    { wch: 15 }, // Zone
    { wch: 30 }, // Site
    { wch: 40 }, // Item Name
    { wch: 10 }, // Unit
    { wch: 12 }, // Rate
    { wch: 15 }, // Closing Qty
    { wch: 15 }, // Total Req
    { wch: 15 }, // Received
    { wch: 15 }, // Balance
  ];
  for (const _ of selectedMonths) {
    wscols.push({ wch: 12 });
    wscols.push({ wch: 15 });
  }
  for (const _ of selectedWeeks) {
    wscols.push({ wch: 12 });
    wscols.push({ wch: 15 });
  }
  ws["!cols"] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "Budget Planning");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(excelBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Budget_Planning_Report.xlsx"`,
    },
  });
}
