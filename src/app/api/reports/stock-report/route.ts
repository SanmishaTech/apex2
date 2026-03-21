import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_STOCK_REPORT]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");

  if (type === "filters") {
    const sites = await prisma.site.findMany({
      select: { id: true, site: true },
      orderBy: { site: "asc" },
    });
    const items = await prisma.item.findMany({
      select: { id: true, item: true },
      orderBy: { item: "asc" },
    });
    const expiryDates = await prisma.siteItemBatch.findMany({
      select: { expiryDate: true },
      distinct: ["expiryDate"],
      where: {
        expiryDate: { not: "" },
      },
      orderBy: { expiryDate: "asc" },
    });

    return NextResponse.json({
      sites: sites.map((s) => ({ value: String(s.id), label: s.site })),
      items: items.map((i) => ({ value: String(i.id), label: i.item })),
      expiryDates: expiryDates.map((e) => ({ value: e.expiryDate, label: e.expiryDate })),
    });
  }

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

  // Aggregation Logic
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
        id: b.id,
        zone: b.site?.zone?.zoneName || "—",
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
    
    // Update expiry range
    if (expiry) {
        if (!row.minExpiry || expiry < row.minExpiry) row.minExpiry = expiry;
        if (!row.maxExpiry || expiry > row.maxExpiry) row.maxExpiry = expiry;
        row.expiries[expiry] = (row.expiries[expiry] || 0) + Number(b.closingQty);
    }

    // Update site summary
    const sKey = String(b.site?.site || "Unknown");
    if (!siteSummaries.has(sKey)) {
        siteSummaries.set(sKey, { site: sKey, good: 0, expired: 0, total: 0 });
    }
    const sSum = siteSummaries.get(sKey)!;
    const val = Number(b.closingQty) * Number(b.unitRate);
    if (expiry && expiry < currentMonthStr) {
        sSum.expired += val;
    } else {
        sSum.good += val;
    }
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
  const formattedExpiryColumns = sortedExpiryColumns.map(e => {
    const [y, m] = e.split("-");
    const label = `${parseInt(m)}/${y.slice(2)}`;
    return { value: e, label };
  });

  const rows = Array.from(grouped.values()).map(r => ({
    ...r,
    expiryRange: formatExpiryRange(r.minExpiry, r.maxExpiry),
  }));

  const summaries = Array.from(siteSummaries.values()).sort((a,b) => a.site.localeCompare(b.site));

  return NextResponse.json({ 
    rows, 
    expiryColumns: formattedExpiryColumns,
    summaries 
  });
}
