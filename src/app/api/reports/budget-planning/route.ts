import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

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
      }
    }
  }

  const validSiteIds = Array.from(validSiteIdsSet);

  if (validSiteIds.length > 0) {
    const [inwardLots, outwardLots] = await Promise.all([
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
      })
    ]);

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
    balance: Math.max(0, r.totalReqQty - r.receivedQty)
  })).sort((a, b) => a.site.localeCompare(b.site) || a.itemName.localeCompare(b.itemName));

  return NextResponse.json({
    data: outputRows,
    meta: {
      selectedMonths,
      selectedWeeks
    }
  });
}
