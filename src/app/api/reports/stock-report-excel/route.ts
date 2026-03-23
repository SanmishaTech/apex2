import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_STOCK_REPORT]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const siteIds = sp.get("siteIds")?.split(",").map(Number).filter(id => !isNaN(id)) || [];
  const itemIds = sp.get("itemIds")?.split(",").map(Number).filter(id => !isNaN(id)) || [];
  const expiryDates = sp.get("expiryDates")?.split(",").filter(Boolean) || [];

  const where: any = {
    closingQty: { gt: 0 },
  };

  if (siteIds.length > 0) where.siteId = { in: siteIds };
  if (itemIds.length > 0) where.itemId = { in: itemIds };
  if (expiryDates.length > 0) where.expiryDate = { in: expiryDates };

  const batches = await prisma.siteItemBatch.findMany({
    where,
    include: {
      site: { select: { site: true, zone: { select: { zoneName: true } } } },
      item: { 
        select: { 
          item: true, 
          unit: { select: { unitName: true } } 
        } 
      },
    },
    orderBy: [
        { site: { site: "asc" } },
        { item: { item: "asc" } }
    ],
  });

  // Aggregation Logic (Match Stock Report API)
  const grouped = new Map<string, any>();
  const uniqueExpiries = new Set<string>();
  const siteSummaries = new Map<string, { site: string, good: number, expired: number, total: number }>();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  batches.forEach((b: any) => {
    const key = `${b.siteId}-${b.itemId}`;
    const expiry = b.expiryDate || "";
    if (expiry) uniqueExpiries.add(expiry);

    if (!grouped.has(key)) {
      grouped.set(key, {
        siteName: b.site?.site || "—",
        itemName: b.item?.item || "—",
        unitName: b.item?.unit?.unitName || "—",
        totalQty: 0,
        totalValue: 0,
        minExpiry: expiry,
        maxExpiry: expiry,
        expiries: {} as Record<string, number>,
      });
    }

    const row = grouped.get(key);
    row.totalQty += Number(b.closingQty);
    row.totalValue += Number(b.closingQty) * Number(b.unitRate);
    if (expiry) {
        if (!row.minExpiry || expiry < row.minExpiry) row.minExpiry = expiry;
        if (!row.maxExpiry || expiry > row.maxExpiry) row.maxExpiry = expiry;
        row.expiries[expiry] = (row.expiries[expiry] || 0) + Number(b.closingQty);
    }

    const sKey = String(b.site?.site || "Unknown");
    if (!siteSummaries.has(sKey)) {
        siteSummaries.set(sKey, { site: sKey, good: 0, expired: 0, total: 0 });
    }
    const sSum = siteSummaries.get(sKey)!;
    const val = Number(b.closingQty) * Number(b.unitRate);
    if (expiry && expiry < currentMonthStr) sSum.expired += val;
    else sSum.good += val;
    sSum.total += val;
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatExpiryRange = (min: string, max: string) => {
    if (!min) return "—";
    const fmt = (s: string) => {
        const [y, m] = s.split("-");
        return `${monthNames[parseInt(m)-1]} ${y}`;
    }
    if (min === max) return fmt(min);
    return `${fmt(min)} - ${fmt(max)}`;
  };

  const sortedExpiryColumns = Array.from(uniqueExpiries).sort();
  const expiryHeaderLabels = sortedExpiryColumns.map(e => {
    const [y, m] = e.split("-");
    return `${parseInt(m)}/${y.slice(2)}`;
  });

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
  const expirySummary = expiryDates.length > 0 ? expiryDates.join(", ") : "All";

  const dateStr = now.toLocaleDateString("en-GB") + " " + now.toLocaleTimeString("en-US", { hour12: true });

  const aoa: any[][] = [
    ["Stock Report"],
    [`Sites: ${siteSummary}`],
    [`Items: ${itemSummary}`],
    [`Expiry Dates: ${expirySummary}`],
    [`Generated on: ${dateStr}`],
    [],
    ["SR No", "Site", "Item Name", "Qty", "Unit", "Amount", "Expiry Range", ...expiryHeaderLabels],
  ];

  const rows = Array.from(grouped.values());
  rows.forEach((r, idx) => {
    const rowData = [
      idx + 1,
      r.siteName,
      r.itemName,
      r.totalQty,
      r.unitName,
      r.totalValue,
      formatExpiryRange(r.minExpiry, r.maxExpiry),
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
