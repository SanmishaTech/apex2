import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { Prisma } from "@prisma/client";

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

  // If expiryFilter is provided, we might need to filter out siteItems that ended up with no batches (if it's an expiry item)
  const filteredSiteItems = expiryFilter.length > 0 
    ? siteItems.filter(si => si.siteItemBatches.length > 0) 
    : siteItems;

  const rows: any[] = [];
  const uniqueExpiries = new Set<string>();
  const siteSummaries = new Map<string, { site: string, good: number, expired: number, total: number }>();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
      id: si.id,
      siteId: si.siteId,
      itemId: si.itemId,
      zone: si.site?.zone?.zoneName || "—",
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

    // Update site summary
    const sKey = String(si.site?.site || "Unknown");
    if (!siteSummaries.has(sKey)) {
        siteSummaries.set(sKey, { site: sKey, good: 0, expired: 0, total: 0 });
    }
    const sSum = siteSummaries.get(sKey)!;

    if (isExpiry && batches.length > 0) {
      batches.forEach((b: any) => {
        const val = Number(b.closingQty) * Number(b.unitRate);
        if (b.expiryDate && b.expiryDate < currentMonthStr) {
          sSum.expired += val;
        } else {
          sSum.good += val;
        }
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
  const formattedExpiryColumns = sortedExpiryColumns.map(e => {
    const [y, m] = e.split("-");
    const label = `${parseInt(m)}/${y.slice(2)}`;
    return { value: e, label };
  });

  // Next lot order date computation
  const pairs = rows.map((r: any) => ({
    siteId: Number(r.siteId),
    itemId: Number(r.itemId),
  }));
  const pairSiteIds = Array.from(new Set(pairs.map((p) => p.siteId)));
  const pairItemIds = Array.from(new Set(pairs.map((p) => p.itemId)));

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
  for (const d of leadPeriodDetails) {
    const k = `${Number(d.leadPeriod.siteId)}-${Number(d.itemId)}`;
    leadPeriodByPair.set(k, Number(d.period ?? 0));
  }
  const maxConsByPair = new Map<string, number>();
  for (const r of maxConsumptions) {
    const k = `${Number(r.siteId)}-${Number(r.itemId)}`;
    const q = Number(r.maxQty ?? 0);
    if (q > 0) maxConsByPair.set(k, q);
  }

  function computeNextLotOrderDate(siteId: number, itemId: number, closingQty: number, isExpiryItem: boolean): string | null {
    
    const k = `${siteId}-${itemId}`;
    const maxQty = maxConsByPair.get(k);
    if (!maxQty || !(maxQty > 0)) return null;
    const leadPeriod = leadPeriodByPair.get(k) ?? 0;

    const daysOfStock = closingQty / maxQty;
    if (!Number.isFinite(daysOfStock)) return null;

    const daysUntilOrder = daysOfStock - leadPeriod;
    if (!Number.isFinite(daysUntilOrder)) return null;

    const d = new Date();
    d.setDate(d.getDate() + Math.round(daysUntilOrder));
    return d.toISOString().slice(0, 10);
  }

  const finalRows = rows.map(r => ({
    ...r,
    expiryRange: formatExpiryRange(r.minExpiry, r.maxExpiry, r.isExpiryItem),
    nextLotOrderDate: computeNextLotOrderDate(
      Number(r.siteId),
      Number(r.itemId),
      Number(r.totalQty),
      r.isExpiryItem
    ),
  }));

  const summaries = Array.from(siteSummaries.values()).sort((a,b) => a.site.localeCompare(b.site));

  return NextResponse.json({ 
    rows: finalRows, 
    expiryColumns: formattedExpiryColumns,
    summaries 
  });
}
