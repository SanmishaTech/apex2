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

function formatDdMmYyyy(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function formatDdMmYyyyTime(d: Date) {
  const ddmm = formatDdMmYyyy(d);
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${ddmm} ${hh}:${min} ${ampm}`;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_SITE_BUDGETS]);
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
      siteId: true,
      site: { select: { site: true } },
    },
  });

  if (!boq) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
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

  // Received lots = Purchase IDC + incoming ODC (as receipts from other site)
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

  const receivedLots: Array<{ date: string; source: string }> = [];
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
      date: formatDdMmYyyy(new Date(x.outwardChallanDate)),
      source: x.fromSite?.site || "",
    });
  }

  // Transferred lots = outgoing ODC from this site
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

  const transferredLots: Array<{ date: string; destination: string }> = [];
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
      date: formatDdMmYyyy(new Date(x.outwardChallanDate)),
      destination: x.toSite?.site || "",
    });
  }

  const itemIds = Array.from(
    new Set<number>([
      ...siteItems.map((si) => Number(si.itemId)),
      ...overallBudgetItems.map((b) => Number(b.itemId)),
    ].filter((v) => Number.isFinite(v)))
  ).sort((a, b) => a - b);

  const wsData: any[][] = [];
  wsData.push(["Material Receiving Report"]);
  wsData.push([`BOQ: ${boq.boqNo ?? "-"}`]);
  wsData.push([`Site: ${boq.site?.site ?? "-"}`]);
  wsData.push([`Generated On: ${formatDdMmYyyyTime(new Date())}`]);
  wsData.push([]);

  const receivedHeaderCols = receivedLots.flatMap((_, i) => [
    `Lot ${i + 1} Date`,
    `Lot ${i + 1} Qty`,
    `Lot ${i + 1} Source`,
  ]);
  const transferredHeaderCols = transferredLots.flatMap((_, i) => [
    `Lot ${i + 1} Date`,
    `Lot ${i + 1} Qty`,
    `Lot ${i + 1} Destination`,
  ]);

  const header = [
    "Sr No",
    "Material Name",
    "Unit",
    "Closing Qty",
    "Overall Qty",
    ...receivedHeaderCols,
    "Received Total",
    ...transferredHeaderCols,
    "Transferred Total",
    "Total Received",
    "Bal to be sent",
  ];

  wsData.push(header);

  for (let idx = 0; idx < itemIds.length; idx++) {
    const itemId = itemIds[idx];
    const si = siteItemByItemId.get(itemId);
    const bi = overallItemInfoByItemId.get(itemId);
    const materialName =
      si?.materialName ||
      `${bi?.itemCode ?? ""}${bi?.item ? " - " + bi.item : ""}`.trim();
    const unitName = si?.unitName || bi?.unitName || "";
    const closingQty = Number(si?.closingQty || 0);

    const overallQtyExists = Boolean(overallQtyExistsByItemId.get(itemId));
    const overallQty = overallQtyExists ? Number(overallQtyByItemId.get(itemId) || 0) : 0;

    const receivedCells = receivedLots.flatMap((lot, li) => {
      const qty = Number(receivedLotItemQtyMaps[li]?.get(itemId) || 0);
      return [lot.date, qty ? Number(fmt2(qty)) : "", lot.source];
    });
    const receivedTotal = receivedLotItemQtyMaps
      .map((m) => Number(m.get(itemId) || 0))
      .reduce((a, b) => a + b, 0);

    const transferredCells = transferredLots.flatMap((lot, li) => {
      const qty = Number(transferredLotItemQtyMaps[li]?.get(itemId) || 0);
      return [lot.date, qty ? Number(fmt2(qty)) : "", lot.destination];
    });
    const transferredTotal = transferredLotItemQtyMaps
      .map((m) => Number(m.get(itemId) || 0))
      .reduce((a, b) => a + b, 0);

    const totalReceived = receivedTotal - transferredTotal;
    const balToBeSent = overallQty - totalReceived;

    wsData.push([
      idx + 1,
      materialName,
      unitName,
      Number(fmt2(closingQty)),
      overallQtyExists ? Number(fmt2(overallQty)) : "",
      ...receivedCells,
      receivedTotal ? Number(fmt2(receivedTotal)) : "",
      ...transferredCells,
      transferredTotal ? Number(fmt2(transferredTotal)) : "",
      totalReceived ? Number(fmt2(totalReceived)) : "",
      balToBeSent ? Number(fmt2(balToBeSent)) : "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const blueHeader = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "FF2563EB" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder(),
  } as any;

  const normalBody = {
    alignment: { vertical: "top", wrapText: true },
    border: thinBorder(),
  } as any;

  const titleRowIdx = 0;
  const headerRowIdx = 5;
  const lastCol = header.length - 1;

  if (!ws["!merges"]) ws["!merges"] = [];
  const merges = ws["!merges"] as any[];
  merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: lastCol } });

  for (let c = 0; c <= lastCol; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: titleRowIdx, c });
    const cell = (ws as any)[cellRef];
    if (!cell) continue;
    cell.s = {
      ...(cell.s || {}),
      font: { ...(cell.s?.font || {}), bold: true },
      alignment: { horizontal: "center", vertical: "center" },
    } as any;
  }

  for (let c = 0; c <= lastCol; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const cell = (ws as any)[cellRef];
    if (!cell) continue;
    cell.s = { ...(cell.s || {}), ...blueHeader } as any;
  }

  for (let r = headerRowIdx + 1; r < wsData.length; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;
      cell.s = { ...(cell.s || {}), ...normalBody } as any;
    }
  }

  ws["!cols"] = header.map((h) => {
    const s = String(h || "");
    const w = Math.min(40, Math.max(12, Math.ceil(s.length * 0.9)));
    return { wch: w };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=material-receiving-report.xlsx`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
