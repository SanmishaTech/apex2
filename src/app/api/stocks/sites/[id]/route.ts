import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function formatYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMDLocal(value: string): Date | null {
  const s = String(value || "").trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!(yyyy > 0 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (
    d.getFullYear() !== yyyy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd
  )
    return null;
  return d;
}

// GET /api/stocks/sites/[id]
// Returns previous 7 days stock report for a site (moved from /report)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid site ID");

    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true, site: true },
    });
    if (!site) return NotFound("Site not found");

    const { searchParams } = new URL(req.url);
    const fromDateParam = (searchParams.get("fromDate") || "").trim();
    const toDateParam = (searchParams.get("toDate") || "").trim();

    const today = startOfDay(new Date());

    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 6);
    const defaultTo = new Date(today);

    const fromDateLocal = fromDateParam ? parseYMDLocal(fromDateParam) : defaultFrom;
    const toDateLocal = toDateParam ? parseYMDLocal(toDateParam) : defaultTo;

    if (!fromDateLocal || !toDateLocal) {
      return BadRequest("Invalid fromDate/toDate. Expected YYYY-MM-DD");
    }
    const startDate = startOfDay(fromDateLocal);
    const endDate = endOfDay(toDateLocal);
    if (startDate > endDate) return BadRequest("fromDate must be before or equal to toDate");

    const days: Date[] = [];
    {
      const cur = startOfDay(new Date(startDate));
      while (cur <= endDate) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
        if (days.length > 366) return BadRequest("Date range is too large");
      }
    }

    const siteItems = await prisma.siteItem.findMany({
      where: { siteId: id },
      select: {
        itemId: true,
        openingStock: true,
        closingStock: true,
        item: { select: { item: true, unit: { select: { unitName: true } } } },
      },
    });
    const siteItemIds = new Set<number>(siteItems.map((s) => s.itemId));

    const ledgersInRange = await prisma.stockLedger.findMany({
      where: { siteId: id, transactionDate: { gte: startDate, lte: endDate } },
      select: {
        itemId: true,
        transactionDate: true,
        receivedQty: true,
        issuedQty: true,
      },
    });
    for (const l of ledgersInRange) siteItemIds.add(l.itemId);

    const itemIds = Array.from(siteItemIds);

    const openingAgg = await prisma.stockLedger.groupBy({
      by: ["itemId"],
      where: {
        siteId: id,
        itemId: { in: itemIds },
        transactionDate: { lt: startDate },
      },
      _sum: { receivedQty: true, issuedQty: true },
    } as any);
    const openingByItem = new Map<number, number>();
    for (const row of openingAgg as any[]) {
      const recv = Number(row._sum?.receivedQty ?? 0);
      const issued = Number(row._sum?.issuedQty ?? 0);
      openingByItem.set(Number(row.itemId), Number((recv - issued).toFixed(4)));
    }

    const dailyMap = new Map<
      number,
      Map<string, { received: number; issued: number }>
    >();
    for (const l of ledgersInRange) {
      const dKey = formatYMDLocal(startOfDay(new Date(l.transactionDate)));
      if (!dailyMap.has(l.itemId)) dailyMap.set(l.itemId, new Map());
      const m = dailyMap.get(l.itemId)!;
      const prev = m.get(dKey) || { received: 0, issued: 0 };
      prev.received = Number(
        (prev.received + Number(l.receivedQty || 0)).toFixed(4)
      );
      prev.issued = Number((prev.issued + Number(l.issuedQty || 0)).toFixed(4));
      m.set(dKey, prev);
    }

    const missingItemIds = itemIds.filter(
      (iid) => !siteItems.some((s) => s.itemId === iid)
    );
    const missingItemsMeta = missingItemIds.length
      ? await prisma.item.findMany({
          where: { id: { in: missingItemIds } },
          select: {
            id: true,
            item: true,
            unit: { select: { unitName: true } },
          },
        })
      : [];

    const metaByItem = new Map<
      number,
      { name: string; unit: string | null; opening?: number; closing?: number }
    >();
    for (const s of siteItems)
      metaByItem.set(s.itemId, {
        name: s.item.item,
        unit: s.item.unit?.unitName ?? null,
        opening: Number(s.openingStock || 0),
        closing: Number(s.closingStock || 0),
      });
    for (const mi of missingItemsMeta)
      if (!metaByItem.has(mi.id))
        metaByItem.set(mi.id, {
          name: mi.item,
          unit: mi.unit?.unitName ?? null,
        });

    const dayKeys = days.map((d) => formatYMDLocal(d));
    const rows = itemIds.map((itemId) => {
      const meta = metaByItem.get(itemId) || {
        name: `Item ${itemId}`,
        unit: null,
      };
      const opening =
        (metaByItem.get(itemId)?.opening ?? undefined) !== undefined
          ? (metaByItem.get(itemId)?.opening as number)
          : 0;
      let recvTotal = 0;
      let issuedTotal = 0;
      const perDay = dayKeys.map((dk) => {
        const cell = dailyMap.get(itemId)?.get(dk) || {
          received: 0,
          issued: 0,
        };
        recvTotal += cell.received;
        issuedTotal += cell.issued;
        return { date: dk, received: cell.received, issued: cell.issued };
      });
      const closing =
        (metaByItem.get(itemId)?.closing ?? undefined) !== undefined
          ? (metaByItem.get(itemId)?.closing as number)
          : 0;
      return {
        itemId,
        item: meta.name,
        unit: meta.unit,
        opening,
        perDay,
        closing,
      };
    });

    return Success({
      site: { id: site.id, site: site.site },
      days: dayKeys,
      rows,
    });
  } catch (error) {
    console.error("Stock site detail error:", error);
    return ApiError("Failed to fetch stock report");
  }
}
