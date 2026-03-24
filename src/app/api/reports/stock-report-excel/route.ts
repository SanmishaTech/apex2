import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import XLSX from "xlsx-js-style";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_STOCK_REPORT]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const siteIds = sp.get("siteIds")?.split(",").map(Number).filter(id => !isNaN(id)) || [];
  const itemIds = sp.get("itemIds")?.split(",").map(Number).filter(id => !isNaN(id)) || [];
  const expiryFilter = sp.get("expiryDates")?.split(",").filter(Boolean) || [];

  const where: any = {
    closingStock: { gt: 0 },
  };

  if (siteIds.length > 0) where.siteId = { in: siteIds };
  if (itemIds.length > 0) where.itemId = { in: itemIds };

  const siteItems = await prisma.siteItem.findMany({
    where,
    include: {
      site: { select: { site: true, zone: { select: { zoneName: true } } } },
      item: { 
        select: { 
          item: true, 
          isExpiryDate: true,
          unit: { select: { unitName: true } } 
        } 
      },
      siteItemBatches: {
        where: expiryFilter.length > 0 ? { expiryDate: { in: expiryFilter } } : undefined,
      },
    },
    orderBy: [
        { site: { site: "asc" } },
        { item: { item: "asc" } }
    ],
  });

  const filteredSiteItems = expiryFilter.length > 0 
    ? siteItems.filter(si => si.siteItemBatches.length > 0) 
    : siteItems;

  const rows: any[] = [];
  const uniqueExpiries = new Set<string>();
  const siteSummaries = new Map<string, { site: string, good: number, expired: number, total: number }>();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

  filteredSiteItems.forEach((si: any) => {
    const isExpiry = si.item?.isExpiryDate === true;
    const batches = si.siteItemBatches || [];
    
    let minExp = "";
    let maxExp = "";
    const itemExpiries: Record<string, number> = {};

    batches.forEach((b: any) => {
      const expiry = b.expiryDate || "";
      if (expiry) {
        uniqueExpiries.add(expiry);
        if (!minExp || expiry < minExp) minExp = expiry;
        if (!maxExp || expiry > maxExp) maxExp = expiry;
        itemExpiries[expiry] = (itemExpiries[expiry] || 0) + Number(b.closingQty);
      }
    });

    const row = {
      siteId: si.siteId,
      itemId: si.itemId,
      siteName: si.site?.site || "—",
      itemName: si.item?.item || "—",
      unitName: si.item?.unit?.unitName || "—",
      totalQty: Number(si.closingStock),
      totalValue: Number(si.closingValue),
      minExpiry: minExp,
      maxExpiry: maxExp,
      expiries: itemExpiries,
      isExpiryItem: isExpiry,
    };

    rows.push(row);

    const sKey = String(si.site?.site || "Unknown");
    if (!siteSummaries.has(sKey)) {
        siteSummaries.set(sKey, { site: sKey, good: 0, expired: 0, total: 0 });
    }
    const sSum = siteSummaries.get(sKey)!;

    if (isExpiry && batches.length > 0) {
      batches.forEach((b: any) => {
        const val = Number(b.closingQty) * Number(b.unitRate);
        if (b.expiryDate && b.expiryDate < currentMonthStr) sSum.expired += val;
        else sSum.good += val;
      });
    } else {
      sSum.good += Number(si.closingValue);
    }
    sSum.total += Number(si.closingValue);
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatExpiryRange = (min: string, max: string, isExpiryItem: boolean) => {
    if (!isExpiryItem) return "Not Applicable";
    if (!min) return "—";
    const fmt = (s: string) => {
        const [y, m] = s.split("-");
        const monthIdx = parseInt(m) - 1;
        return `${monthNames[monthIdx] || m} ${y}`;
    }
    if (min === max) return fmt(min);
    return `${fmt(min)} - ${fmt(max)}`;
  };

  const sortedExpiryColumns = Array.from(uniqueExpiries).sort();
  const expiryHeaderLabels = sortedExpiryColumns.map(e => {
    const [y, m] = e.split("-");
    const label = `${parseInt(m)}/${y.slice(2)}`;
    return label;
  });

  // Next lot order date computation
  const pairs = rows.map((r: any) => ({
    siteId: Number(r.siteId),
    itemId: Number(r.itemId),
  }));
  const pairSiteIds = Array.from(new Set(pairs.map((p) => p.siteId))) as number[];
  const pairItemIds = Array.from(new Set(pairs.map((p) => p.itemId))) as number[];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [leadPeriodDetails, maxConsumptions] = await Promise.all([
    prisma.leadPeriodDetail.findMany({
      where: {
        itemId: { in: pairItemIds.length ? pairItemIds : [-1] },
        leadPeriod: { siteId: { in: pairSiteIds.length ? pairSiteIds : [-1] } },
      },
      select: {
        itemId: true,
        period: true,
        leadPeriod: { select: { siteId: true } },
      },
    }),
    prisma.$queryRaw<
      Array<{ siteId: number; itemId: number; maxQty: number | null }>
    >(Prisma.sql`
      SELECT dc.siteId as siteId, dcd.itemId as itemId, MAX(dcd.qty) as maxQty
      FROM daily_consumption_details dcd
      INNER JOIN daily_consumptions dc ON dc.id = dcd.dailyConsumptionId
      WHERE dc.dailyConsumptionDate >= ${sevenDaysAgo}
        AND dc.siteId IN (${Prisma.join(pairSiteIds.length ? pairSiteIds : [-1])})
        AND dcd.itemId IN (${Prisma.join(pairItemIds.length ? pairItemIds : [-1])})
      GROUP BY dc.siteId, dcd.itemId
    `),
  ]);

  const leadPeriodByPair = new Map<string, number>();
  for (const d of (leadPeriodDetails as any[])) {
    const k = `${Number(d.leadPeriod.siteId)}-${Number(d.itemId)}`;
    leadPeriodByPair.set(k, Number(d.period ?? 0));
  }
  const maxConsByPair = new Map<string, number>();
  for (const r of maxConsumptions) {
    const k = `${Number(r.siteId)}-${Number(r.itemId)}`;
    const q = Number(r.maxQty ?? 0);
    if (q > 0) maxConsByPair.set(k, q);
  }

  function computeNextLotOrderDate(siteId: number, itemId: number, closingQty: number, isExpiryItem: boolean): string {
    
    const k = `${siteId}-${itemId}`;
    const maxQty = maxConsByPair.get(k);
    if (!maxQty || !(maxQty > 0)) return "—";
    const leadPeriod = leadPeriodByPair.get(k) ?? 0;
    const daysOfStock = closingQty / maxQty;
    if (!Number.isFinite(daysOfStock)) return "—";
    const daysUntilOrder = daysOfStock - leadPeriod;
    if (!Number.isFinite(daysUntilOrder)) return "—";
    const d = new Date();
    d.setDate(d.getDate() + Math.round(daysUntilOrder));
    return d.toISOString().slice(0, 10);
  }

  const [selectedSites, selectedItems] = await Promise.all([
    siteIds.length > 0
      ? prisma.site.findMany({ where: { id: { in: siteIds } }, select: { site: true } })
      : [],
    itemIds.length > 0
      ? prisma.item.findMany({ where: { id: { in: itemIds } }, select: { item: true } })
      : [],
  ]);

  const siteSummary = siteIds.length > 0 ? selectedSites.map((s) => s.site).join(", ") : "All";
  const itemSummary = itemIds.length > 0 ? selectedItems.map((i) => i.item).join(", ") : "All";
  const expirySummary = expiryFilter.length > 0 ? expiryFilter.join(", ") : "All";

  const dateStr = now.toLocaleDateString("en-GB") + " " + now.toLocaleTimeString("en-US", { hour12: true });

  const aoa: any[][] = [
    ["Stock Report"],
    [`Sites: ${siteSummary}`],
    [`Items: ${itemSummary}`],
    [`Expiry Dates: ${expirySummary}`],
    [`Generated on: ${dateStr}`],
    [],
    ["SR No", "Site", "Item Name", "Qty", "Unit", "Amount", "Next lot order date", "Expiry Range", ...expiryHeaderLabels],
  ];

  const rowsToRender = rows;
  rowsToRender.forEach((r, idx) => {
    const nextLotDate = computeNextLotOrderDate(Number(r.siteId), Number(r.itemId), Number(r.totalQty), r.isExpiryItem);
    const rowData = [
      idx + 1,
      r.siteName,
      r.itemName,
      r.totalQty,
      r.unitName,
      r.totalValue,
      nextLotDate,
      formatExpiryRange(r.minExpiry, r.maxExpiry, r.isExpiryItem),
    ];
    sortedExpiryColumns.forEach(exp => {
      rowData.push(r.expiries[exp] || 0);
    });
    aoa.push(rowData);
  });

  aoa.push([]);
  aoa.push(["Site-wise Summary"]);
  aoa.push(["SR No", "Site Name", "Good Items Amount", "Expired Items Amount", "Total Amount"]);
  
  const summaries = Array.from(siteSummaries.values()).sort((a,b) => a.site.localeCompare(b.site));
  summaries.forEach((s, idx) => {
    aoa.push([
      idx + 1,
      s.site,
      s.good,
      s.expired,
      s.total,
    ]);
  });

  if (summaries.length > 0) {
    const grandGood = summaries.reduce((acc, s) => acc + s.good, 0);
    const grandExpired = summaries.reduce((acc, s) => acc + s.expired, 0);
    const grandTotal = summaries.reduce((acc, s) => acc + s.total, 0);

    aoa.push([
      "",
      "Grand Total",
      grandGood,
      grandExpired,
      grandTotal,
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Styling logic
  const defaultStyle = { font: { sz: 10 }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
  const headerStyle = { ...defaultStyle, fill: { fgColor: { rgb: "0369A1" } }, font: { color: { rgb: "FFFFFF" }, bold: true }, alignment: { horizontal: "center" } };
  const expiredStyle = { ...defaultStyle, fill: { fgColor: { rgb: "DC2626" } }, font: { color: { rgb: "FFFFFF" }, bold: true } };
  const expiringSoonStyle = { ...defaultStyle, fill: { fgColor: { rgb: "FACC15" } }, font: { color: { rgb: "000000" }, bold: true } };
  const blueStyle = { ...defaultStyle, fill: { fgColor: { rgb: "2563EB" } }, font: { color: { rgb: "FFFFFF" }, bold: true } };

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const fiveDaysFromNow = new Date(todayDate);
  fiveDaysFromNow.setDate(todayDate.getDate() + 5);

  // Apply styles to Main Table
  const headerRowIdx = 6;
  const dataStartRowIdx = 7;
  const reportRowsCount = rows.length;

  for (let c = 0; c < 8 + sortedExpiryColumns.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[addr]) ws[addr].s = headerStyle;
  }

  rows.forEach((r, idx) => {
    const rowIdx = dataStartRowIdx + idx;
    
    // Default style for SR No to Amount columns (0 to 5)
    for (let c = 0; c <= 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[addr]) ws[addr].s = defaultStyle;
    }

    // Next Lot Order Date Column (Indx 6)
    const nextLotDateAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 6 });
    const nextLotDate = ws[nextLotDateAddr]?.v;
    if (ws[nextLotDateAddr]) {
        ws[nextLotDateAddr].s = defaultStyle;
        if (nextLotDate && nextLotDate !== "—") {
            const d = new Date(nextLotDate);
            if (d >= todayDate && d <= fiveDaysFromNow) {
                ws[nextLotDateAddr].s = blueStyle;
            }
        }
    }

    // Expiry Range Column (Index 7)
    const expiryRangeAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 7 });
    const minExpiry = r.minExpiry;
    if (ws[expiryRangeAddr]) {
        ws[expiryRangeAddr].s = defaultStyle;
        if (minExpiry) {
            if (minExpiry < currentMonthStr) ws[expiryRangeAddr].s = expiredStyle;
            else if (minExpiry === currentMonthStr || minExpiry === nextMonthStr) ws[expiryRangeAddr].s = expiringSoonStyle;
        }
    }

    // Expiry Columns (Index 8 onwards)
    sortedExpiryColumns.forEach((exp, cIdx) => {
        const c = 8 + cIdx;
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[addr]) {
            ws[addr].s = defaultStyle;
            if (ws[addr].v && ws[addr].v !== 0) {
                if (exp < currentMonthStr) ws[addr].s = expiredStyle;
                else if (exp === currentMonthStr || exp === nextMonthStr) ws[addr].s = expiringSoonStyle;
            }
        }
    });
  });

  // Apply styles to Summary Table
  const summaryHeaderRowIdx = dataStartRowIdx + reportRowsCount + 2;
  const summaryDataStartIdx = summaryHeaderRowIdx + 1;
  const summaryRowsCount = summaries.length;

  for (let c = 0; c < 5; c++) {
    const addr = XLSX.utils.encode_cell({ r: summaryHeaderRowIdx, c });
    if (ws[addr]) ws[addr].s = headerStyle;
  }

  summaries.forEach((s, idx) => {
    const rowIdx = summaryDataStartIdx + idx;
    for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[addr]) {
            ws[addr].s = defaultStyle;
            if (c === 3) ws[addr].s = { ...defaultStyle, font: { ...defaultStyle.font, color: { rgb: "DC2626" } } };
        }
    }
  });

  // Grand Total row
  if (summaries.length > 0) {
    const grandTotalIdx = summaryDataStartIdx + summaryRowsCount;
    for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: grandTotalIdx, c });
        if (ws[addr]) {
            ws[addr].s = { ...defaultStyle, font: { ...defaultStyle.font, bold: true } };
            if (c === 3) ws[addr].s.font.color = { rgb: "DC2626" };
        }
    }
  }

  ws["!cols"] = [
    { wch: 6 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
    ...expiryHeaderLabels.map(() => ({ wch: 8 }))
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, "Stock Report");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=stock-report.xlsx",
    },
  });
}
