import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function formatDdMmYyyy(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

type Lot = {
  id: number;
  label: string;
  date: string;
  source?: string;
  destination?: string;
};

type Row = {
  itemId: number;
  materialName: string;
  unitName: string;
  closingQty: number;
  overallQty: number;
  overallQtyExists: boolean;
  receivedLotQty: number[];
  receivedTotal: number;
  transferredLotQty: number[];
  transferredTotal: number;
  totalReceived: number;
  balToBeSent: number;
};

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_SITE_BUDGETS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const boqIdRaw = sp.get("boqId");
  const boqId = boqIdRaw ? Number(boqIdRaw) : NaN;
  if (!boqIdRaw || Number.isNaN(boqId) || boqId <= 0) {
    return NextResponse.json({ message: "boqId is required" }, { status: 400 });
  }

  const boq = await prisma.boq.findUnique({
    where: { id: boqId },
    select: {
      id: true,
      boqNo: true,
      siteId: true,
      site: { select: { site: true } },
    },
  });

  if (!boq) {
    return NextResponse.json({ message: "BOQ not found" }, { status: 404 });
  }

  const siteId = Number(boq.siteId);

  const siteItems = await prisma.siteItem.findMany({
    where: { siteId },
    select: {
      itemId: true,
      closingStock: true,
      item: {
        select: {
          itemCode: true,
          item: true,
          unit: { select: { unitName: true } },
        },
      },
    },
    orderBy: [{ itemId: "asc" }],
  });

  const overallBudgetItems = await prisma.overallSiteBudgetItem.findMany({
    where: {
      overallSiteBudgetDetail: {
        overallSiteBudget: {
          boqId,
        },
      },
    },
    select: {
      itemId: true,
      budgetQty: true,
      item: {
        select: {
          itemCode: true,
          item: true,
          unit: { select: { unitName: true } },
        },
      },
    },
  });

  const overallQtyByItemId = new Map<number, number>();
  const overallQtyExistsByItemId = new Map<number, boolean>();
  const overallItemInfoByItemId = new Map<
    number,
    { itemCode?: string | null; item?: string | null; unitName?: string | null }
  >();
  for (const b of overallBudgetItems) {
    const id = Number(b.itemId);
    const qty = Number(b.budgetQty ?? 0);
    overallQtyByItemId.set(id, (overallQtyByItemId.get(id) || 0) + qty);
    overallQtyExistsByItemId.set(id, true);
    if (!overallItemInfoByItemId.has(id)) {
      overallItemInfoByItemId.set(id, {
        itemCode: (b as any).item?.itemCode ?? null,
        item: (b as any).item?.item ?? null,
        unitName: (b as any).item?.unit?.unitName ?? null,
      });
    }
  }

  const siteItemByItemId = new Map<
    number,
    {
      materialName: string;
      unitName: string;
      closingQty: number;
    }
  >();
  for (const si of siteItems) {
    const itemId = Number(si.itemId);
    const materialName = `${si.item?.itemCode ?? ""}${si.item?.item ? " - " + si.item.item : ""}`.trim();
    const unitName = si.item?.unit?.unitName || "";
    const closingQty = Number((si as any).closingStock ?? 0);
    siteItemByItemId.set(itemId, { materialName, unitName, closingQty });
  }

  const idcLotsRaw = await prisma.inwardDeliveryChallan.findMany({
    where: { siteId },
    select: {
      id: true,
      inwardChallanDate: true,
      inwardDeliveryChallanDetails: {
        select: {
          receivingQty: true,
          poDetails: { select: { itemId: true } },
        },
      },
    },
    orderBy: [{ inwardChallanDate: "asc" }, { id: "asc" }],
  });

  const incomingOdcLotsRaw = await prisma.outwardDeliveryChallan.findMany({
    where: { toSiteId: siteId },
    select: {
      id: true,
      outwardChallanDate: true,
      fromSite: { select: { site: true } },
      outwardDeliveryChallanDetails: {
        select: { itemId: true, challanQty: true },
      },
    },
    orderBy: [{ outwardChallanDate: "asc" }, { id: "asc" }],
  });

  const outgoingOdcLotsRaw = await prisma.outwardDeliveryChallan.findMany({
    where: { fromSiteId: siteId },
    select: {
      id: true,
      outwardChallanDate: true,
      toSite: { select: { site: true } },
      outwardDeliveryChallanDetails: {
        select: { itemId: true, challanQty: true },
      },
    },
    orderBy: [{ outwardChallanDate: "asc" }, { id: "asc" }],
  });

  const receivedLots: Lot[] = [];
  const receivedLotItemQtyMaps: Array<Map<number, number>> = [];

  for (const x of idcLotsRaw) {
    const perItem = new Map<number, number>();
    for (const d of x.inwardDeliveryChallanDetails || []) {
      const itemId = Number(d.poDetails?.itemId);
      if (!Number.isFinite(itemId)) continue;
      const qty = Number(d.receivingQty ?? 0);
      perItem.set(itemId, (perItem.get(itemId) || 0) + qty);
    }
    receivedLotItemQtyMaps.push(perItem);
    receivedLots.push({
      id: Number(x.id),
      label: "",
      date: formatDdMmYyyy(new Date(x.inwardChallanDate)),
      source: "Purchase",
    });
  }

  for (const x of incomingOdcLotsRaw) {
    const perItem = new Map<number, number>();
    for (const d of x.outwardDeliveryChallanDetails || []) {
      const itemId = Number(d.itemId);
      if (!Number.isFinite(itemId)) continue;
      const qty = Number(d.challanQty ?? 0);
      perItem.set(itemId, (perItem.get(itemId) || 0) + qty);
    }
    receivedLotItemQtyMaps.push(perItem);
    receivedLots.push({
      id: -Number(x.id),
      label: "",
      date: formatDdMmYyyy(new Date(x.outwardChallanDate)),
      source: x.fromSite?.site || "",
    });
  }

  receivedLots.forEach((l, i) => {
    l.label = `Lot ${i + 1}`;
  });

  const transferredLots: Lot[] = [];
  const transferredLotItemQtyMaps: Array<Map<number, number>> = [];

  for (const x of outgoingOdcLotsRaw) {
    const perItem = new Map<number, number>();
    for (const d of x.outwardDeliveryChallanDetails || []) {
      const itemId = Number(d.itemId);
      if (!Number.isFinite(itemId)) continue;
      const qty = Number(d.challanQty ?? 0);
      perItem.set(itemId, (perItem.get(itemId) || 0) + qty);
    }
    transferredLotItemQtyMaps.push(perItem);
    transferredLots.push({
      id: Number(x.id),
      label: "",
      date: formatDdMmYyyy(new Date(x.outwardChallanDate)),
      destination: x.toSite?.site || "",
    });
  }

  transferredLots.forEach((l, i) => {
    l.label = `Lot ${i + 1}`;
  });

  const itemIds = Array.from(
    new Set<number>([
      ...siteItems.map((si) => Number(si.itemId)),
      ...overallBudgetItems.map((b) => Number(b.itemId)),
    ].filter((v) => Number.isFinite(v)))
  ).sort((a, b) => a - b);

  const rows: Row[] = itemIds.map((itemId) => {
    const si = siteItemByItemId.get(itemId);
    const bi = overallItemInfoByItemId.get(itemId);
    const materialName =
      si?.materialName ||
      `${bi?.itemCode ?? ""}${bi?.item ? " - " + bi.item : ""}`.trim();
    const unitName = si?.unitName || bi?.unitName || "";
    const closingQty = Number(si?.closingQty || 0);

    const overallQtyExists = Boolean(overallQtyExistsByItemId.get(itemId));
    const overallQty = overallQtyExists ? Number(overallQtyByItemId.get(itemId) || 0) : 0;

    const receivedLotQty = receivedLotItemQtyMaps.map((m) =>
      Number(m.get(itemId) || 0)
    );
    const receivedTotal = receivedLotQty.reduce((a, b) => a + Number(b || 0), 0);

    const transferredLotQty = transferredLotItemQtyMaps.map((m) =>
      Number(m.get(itemId) || 0)
    );
    const transferredTotal = transferredLotQty.reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const totalReceived = receivedTotal - transferredTotal;
    const balToBeSent = overallQty - totalReceived;

    return {
      itemId,
      materialName,
      unitName,
      closingQty,
      overallQty,
      overallQtyExists,
      receivedLotQty,
      receivedTotal,
      transferredLotQty,
      transferredTotal,
      totalReceived,
      balToBeSent,
    };
  });

  return NextResponse.json(
    {
      meta: {
        boqId: boq.id,
        boqNo: boq.boqNo || "-",
        siteName: boq.site?.site || "-",
        generatedAt: new Date().toISOString(),
        receivedLots,
        transferredLots,
      },
      rows,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
