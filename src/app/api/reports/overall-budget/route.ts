import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_OVERALL_BUDGET_REPORT]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const boqIdRaw = sp.get("boqId");
  const boqId = boqIdRaw ? Number(boqIdRaw) : NaN;
  if (!boqIdRaw || Number.isNaN(boqId) || boqId <= 0) {
    return NextResponse.json({ error: "boqId is required" }, { status: 400 });
  }

  const boq = await prisma.boq.findUnique({
    where: { id: boqId },
    select: {
      id: true,
      boqNo: true,
      workName: true,
      site: { select: { id: true, site: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          activityId: true,
          item: true,
          unit: { select: { unitName: true } },
          qty: true,
          rate: true,
        },
      },
    },
  });

  if (!boq) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  const budgets = await prisma.overallSiteBudget.findMany({
    where: { boqId },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      overallSiteBudgetDetails: {
        select: {
          BoqItemId: true,
          overallSiteBudgetItems: {
            select: {
              itemId: true,
              item: { select: { itemCode: true, item: true, unit: { select: { unitName: true } } } },
              budgetQty: true,
              budgetRate: true,
              budgetValue: true,
            },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  const budgetItemLabelById: Record<number, string> = {};
  const budgetItemUnitById: Record<number, string> = {};
  const qtyByBoqItemIdByBudgetItemId = new Map<number, Map<number, number>>();
  const totalQtyByBudgetItemId: Record<number, number> = {};
  const totalValueByBudgetItemId: Record<number, number> = {};

  for (const b of budgets || []) {
    for (const d of (b.overallSiteBudgetDetails || []) as any[]) {
      const boqItemId = Number(d.BoqItemId);
      if (!Number.isFinite(boqItemId) || boqItemId <= 0) continue;

      for (const it of (d.overallSiteBudgetItems || []) as any[]) {
        const budgetItemId = Number(it.itemId);
        if (!Number.isFinite(budgetItemId) || budgetItemId <= 0) continue;

        const label = `${it.item?.itemCode ?? ""}${it.item?.item ? " - " + it.item.item : ""}`.trim();
        if (label && !budgetItemLabelById[budgetItemId]) {
          budgetItemLabelById[budgetItemId] = label;
        }

        const unitName = it.item?.unit?.unitName || "";
        if (!budgetItemUnitById[budgetItemId]) {
          budgetItemUnitById[budgetItemId] = unitName;
        }

        const qty = Number(it.budgetQty || 0);
        const value = Number(it.budgetValue || 0);

        if (!qtyByBoqItemIdByBudgetItemId.has(boqItemId)) {
          qtyByBoqItemIdByBudgetItemId.set(boqItemId, new Map());
        }
        const m = qtyByBoqItemIdByBudgetItemId.get(boqItemId)!;
        m.set(budgetItemId, (m.get(budgetItemId) || 0) + qty);
        
        totalQtyByBudgetItemId[budgetItemId] = (totalQtyByBudgetItemId[budgetItemId] || 0) + qty;
        totalValueByBudgetItemId[budgetItemId] = (totalValueByBudgetItemId[budgetItemId] || 0) + value;
      }
    }
  }

  const averageRateByBudgetItemId: Record<number, number> = {};
  for (const id of Object.keys(totalQtyByBudgetItemId).map(Number)) {
    const q = totalQtyByBudgetItemId[id] || 0;
    const v = totalValueByBudgetItemId[id] || 0;
    averageRateByBudgetItemId[id] = q > 0 ? v / q : 0;
  }

  const budgetItemIds = Object.keys(budgetItemLabelById).map(Number).sort((a, b) => {
    const an = (budgetItemLabelById[a] || "").toLowerCase();
    const bn = (budgetItemLabelById[b] || "").toLowerCase();
    return an.localeCompare(bn);
  });

  const rows = (boq.items || []).map((it: any) => {
    const boqItemId = Number(it.id);
    const m = qtyByBoqItemIdByBudgetItemId.get(boqItemId);
    
    const qtyMap: Record<number, number> = {};
    for(const id of budgetItemIds) {
      qtyMap[id] = Number(m?.get(id) || 0);
    }

    return {
      activityId: it.activityId || "",
      boqItemName: it.item || "",
      boqQty: Number(it.qty || 0),
      unitName: it.unit?.unitName || "",
      qtyMap
    };
  });

  const siteItems = await prisma.siteItem.findMany({
    where: { 
      siteId: boq.site?.id || 0,
      itemId: { in: budgetItemIds }
    }
  });

  const closingQtyMap: Record<number, number> = {};
  siteItems.forEach((si: any) => closingQtyMap[si.itemId] = Number(si.closingStock || 0));

  return NextResponse.json({
    meta: {
      boqNo: boq.boqNo,
      workName: boq.workName,
      siteName: boq.site?.site || ""
    },
    budgetItemIds,
    budgetItemLabels: budgetItemLabelById,
    budgetItemUnits: budgetItemUnitById,
    closingQtyMap,
    averageRates: averageRateByBudgetItemId,
    totalAmounts: totalValueByBudgetItemId,
    rows,
    totals: totalQtyByBudgetItemId
  });
}
