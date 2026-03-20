import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

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

  const rows: any[] = [];
  
  budgets.forEach(b => {
    (b.siteBudgetDetails || []).forEach(d => {
      (d.siteBudgetItems || []).forEach(it => {
        if (!it.budgetQty || Number(it.budgetQty) <= 0) return;
        
        rows.push({
          zone: b.site?.zone?.zoneName || "-",
          site: b.site?.site || "-",
          itemName: `${it.item?.itemCode ?? ""}${it.item?.item ? " - " + it.item.item : ""}`.trim(),
          unit: (it as any).item?.unit?.unitName || "-",
          month: b.month || "-",
          week: b.week || "-",
          budgetQty: Number(it.budgetQty || 0),
          budgetRate: Number(it.budgetRate || 0),
          budgetValue: Number(it.budgetValue || 0),
        });
      });
    });
  });

  return NextResponse.json({
    data: rows
  });
}
