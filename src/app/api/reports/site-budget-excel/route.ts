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

function safeLabel(s: string) {
  return String(s || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
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

  const budgets = await (prisma as any).siteBudget.findMany({
    where: { boqId },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      siteBudgetDetails: {
        select: {
          BoqItemId: true,
          siteBudgetItems: {
            select: {
              itemId: true,
              item: { select: { itemCode: true, item: true } },
              budgetQty: true,
            },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  const budgetItemLabelById = new Map<number, string>();
  const qtyByBoqItemIdByBudgetItemId = new Map<number, Map<number, number>>();
  const totalQtyByBudgetItemId = new Map<number, number>();

  for (const b of budgets || []) {
    for (const d of (b.siteBudgetDetails || []) as any[]) {
      const boqItemId = Number(d.BoqItemId);
      if (!Number.isFinite(boqItemId) || boqItemId <= 0) continue;

      for (const it of (d.siteBudgetItems || []) as any[]) {
        const budgetItemId = Number(it.itemId);
        if (!Number.isFinite(budgetItemId) || budgetItemId <= 0) continue;

        const label = `${it.item?.itemCode ?? ""}${it.item?.item ? " - " + it.item.item : ""}`.trim();
        if (label && !budgetItemLabelById.has(budgetItemId)) {
          budgetItemLabelById.set(budgetItemId, label);
        }

        const qty = Number(it.budgetQty || 0);
        if (!qtyByBoqItemIdByBudgetItemId.has(boqItemId)) {
          qtyByBoqItemIdByBudgetItemId.set(boqItemId, new Map());
        }
        const m = qtyByBoqItemIdByBudgetItemId.get(boqItemId)!;
        m.set(budgetItemId, (m.get(budgetItemId) || 0) + qty);
        totalQtyByBudgetItemId.set(budgetItemId, (totalQtyByBudgetItemId.get(budgetItemId) || 0) + qty);
      }
    }
  }

  const budgetItemIds = Array.from(budgetItemLabelById.keys()).sort((a, b) => {
    const an = (budgetItemLabelById.get(a) || "").toLowerCase();
    const bn = (budgetItemLabelById.get(b) || "").toLowerCase();
    return an.localeCompare(bn);
  });

  const wsData: any[][] = [];
  wsData.push(["Budget Report"]);
  wsData.push([
    `BOQ: ${boq.boqNo ?? "-"}${boq.workName ? " - " + safeLabel(boq.workName) : ""}`,
  ]);
  wsData.push([`Site: ${boq.site?.site ?? "-"}`]);
  wsData.push([`Generated On: ${formatDdMmYyyyTime(new Date())}`]);
  wsData.push([]);

  const baseHeaders = ["Activity ID", "BOQ Item", "BOQ Qty", "Unit"];
  const header = [...baseHeaders, ...budgetItemIds.map((id) => budgetItemLabelById.get(id) || String(id))];
  wsData.push(header);

  for (const it of boq.items || []) {
    const boqItemId = Number((it as any).id);
    const activityId = (it as any).activityId || "";
    const boqItemName = (it as any).item || "";
    const boqQty = Number((it as any).qty || 0);
    const unitName = (it as any).unit?.unitName || "";

    const m = qtyByBoqItemIdByBudgetItemId.get(boqItemId);
    const qtyCells = budgetItemIds.map((budgetItemId) => {
      const v = Number(m?.get(budgetItemId) || 0);
      return v ? Number(fmt2(v)) : "";
    });

    wsData.push([
      activityId,
      boqItemName,
      Number(fmt2(boqQty)),
      unitName,
      ...qtyCells,
    ]);
  }

  const totalsRow: any[] = [
    "TOTAL",
    "",
    "",
    "",
    ...budgetItemIds.map((id) => Number(fmt2(Number(totalQtyByBudgetItemId.get(id) || 0)))),
  ];
  wsData.push(totalsRow);
  const totalRowIdx = wsData.length - 1;

  for (let i = 0; i < 10; i++) wsData.push([]);

  const secondHeaderRowIndex = wsData.length;
  wsData.push(["Item", "Total Qty"]);
  for (const id of budgetItemIds) {
    wsData.push([
      budgetItemLabelById.get(id) || String(id),
      Number(fmt2(Number(totalQtyByBudgetItemId.get(id) || 0))),
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

  const totalBody = {
    font: { bold: true },
    alignment: { vertical: "top" },
    border: thinBorder(),
  } as any;

  const titleRowIdx = 0;
  const headerRowIdx = 5;
  const lastCol = header.length - 1;

  // Merge title across all columns
  if (!ws["!merges"]) ws["!merges"] = [];
  const merges = ws["!merges"] as any[];
  merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: lastCol } });

  // Style title
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

  // Style first table header
  for (let c = 0; c <= lastCol; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const cell = (ws as any)[cellRef];
    if (!cell) continue;
    cell.s = { ...(cell.s || {}), ...blueHeader } as any;
  }

  // Style second table header
  for (let c = 0; c <= 1; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: secondHeaderRowIndex, c });
    const cell = (ws as any)[cellRef];
    if (!cell) continue;
    cell.s = { ...(cell.s || {}), ...blueHeader } as any;
  }

  // Style body + total row
  for (let r = headerRowIdx + 1; r < wsData.length; r++) {
    if (r === secondHeaderRowIndex) continue;
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;
      const base = r === totalRowIdx ? totalBody : normalBody;
      cell.s = {
        ...(cell.s || {}),
        ...base,
      } as any;
    }
  }

  const cols: Array<{ wch: number }> = [
    { wch: 12 },
    { wch: 45 },
    { wch: 12 },
    { wch: 10 },
    ...budgetItemIds.map(() => ({ wch: 18 })),
  ];
  ws["!cols"] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Budget");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `site-budget-report-B${boqId}-${today}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename=${fileName}`,
      "Cache-Control": "no-store",
    },
  });
}
