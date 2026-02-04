import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function fmtQty(n: number) {
  return Number(n || 0).toFixed(2);
}

function fmtRs(n: number) {
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

function safeLabel(s: string) {
  return String(s || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function inclusiveDays(from: Date, to: Date) {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff + 1);
}

function formatRange(from: Date, to: Date) {
  const fmt = (d: Date) => {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yy = String(d.getUTCFullYear());
    return `${dd}/${mm}/${yy}`;
  };
  return `${fmt(from)} - ${fmt(to)}`;
}

function formatDateTime(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min} ${ampm}`;
}

function monthIndexFromLabel(label: string): number | null {
  const monthName = String(label || "").trim().split(" ")[0];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const idx = names.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
  return idx >= 0 ? idx : null;
}

function yearFromLabel(label: string): number | null {
  const parts = String(label || "").trim().split(" ");
  const yearStr = parts[parts.length - 1];
  const y = Number(yearStr);
  return Number.isFinite(y) ? y : null;
}

function isoFromUtcDate(d: Date) {
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ddMMyyyyFromIso(iso: string) {
  const parts = String(iso || "").split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_BOQS]);
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const boqIdRaw = sp.get("boqId");
  const month = (sp.get("month") || "").trim();
  const boqId = boqIdRaw ? Number(boqIdRaw) : NaN;

  if (!boqIdRaw || Number.isNaN(boqId) || boqId <= 0) {
    return NextResponse.json({ error: "boqId is required" }, { status: 400 });
  }
  if (!month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
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
          clientSrNo: true,
          item: true,
          unit: { select: { unitName: true } },
          qty: true,
          rate: true,
          amount: true,
          orderedQty: true,
          remainingQty: true,
          orderedValue: true,
          remainingValue: true,
          isGroup: true,
        },
      },
    },
  });

  if (!boq) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  const targets = await prisma.boqTarget.findMany({
    where: {
      boqId,
      month,
    },
    orderBy: [{ fromTargetDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      fromTargetDate: true,
      toTargetDate: true,
      boqTargetDetails: {
        select: {
          BoqItemId: true,
          totalMonthQty: true,
          dailyTargetQty: true,
        },
      },
    },
  });

  if (!targets.length) {
    return NextResponse.json(
      { error: `No BOQ Targets found for selected month (${month})` },
      { status: 404 }
    );
  }

  const weeks = targets.map((t, idx) => {
    const from = new Date(t.fromTargetDate as any);
    const to = new Date(t.toTargetDate as any);
    const days = inclusiveDays(from, to);
    const labelBase = `${idx + 1}${idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"} Week`;
    const label = `${labelBase} (${formatRange(from, to)})`;
    return {
      id: t.id,
      label,
      from,
      to,
      days,
      details: t.boqTargetDetails || [],
    };
  });

  const monthTotalQtyByItemId = new Map<number, number>();
  const byWeekIdByItemId = new Map<number, Map<number, number>>();
  for (const w of weeks) {
    const m = new Map<number, number>();
    for (const d of w.details) {
      const itemId = Number((d as any).BoqItemId);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      const daily = Number((d as any).dailyTargetQty || 0);
      const weeklyTargetQty = daily;
      m.set(itemId, weeklyTargetQty);

      if (!monthTotalQtyByItemId.has(itemId)) {
        monthTotalQtyByItemId.set(itemId, Number((d as any).totalMonthQty || 0));
      }
    }
    byWeekIdByItemId.set(w.id, m);
  }

  const siteId = Number((boq as any)?.site?.id);
  const executedByWeekIdByItemId = new Map<number, Map<number, number>>();
  for (const w of weeks) {
    const agg = await prisma.dailyProgressDetail.groupBy({
      by: ["boqItemId"],
      _sum: { doneQty: true },
      where: {
        dailyProgress: {
          boqId,
          ...(Number.isFinite(siteId) && siteId > 0 ? { siteId } : {}),
          progressDate: {
            gte: w.from,
            lte: w.to,
          },
        },
      },
    });
    const m = new Map<number, number>();
    for (const r of agg) {
      const id = Number((r as any).boqItemId);
      if (!Number.isFinite(id) || id <= 0) continue;
      m.set(id, Number((r as any)?._sum?.doneQty || 0));
    }
    executedByWeekIdByItemId.set(w.id, m);
  }

  const mi = monthIndexFromLabel(month);
  const yr = yearFromLabel(month);
  if (mi === null || yr === null) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(yr, mi, 1));
  const monthEndExclusive = new Date(Date.UTC(yr, mi + 1, 1));
  const daysInMonth = new Date(yr, mi + 1, 0).getDate();
  const monthIsoDays = Array.from({ length: daysInMonth }).map((_, i) => {
    const d = new Date(Date.UTC(yr, mi, i + 1));
    return isoFromUtcDate(d);
  });

  const dailyRows = await prisma.dailyProgressDetail.findMany({
    where: {
      dailyProgress: {
        boqId,
        ...(Number.isFinite(siteId) && siteId > 0 ? { siteId } : {}),
        progressDate: { gte: monthStart, lt: monthEndExclusive },
      },
    },
    select: {
      boqItemId: true,
      doneQty: true,
      dailyProgress: { select: { progressDate: true } },
    },
  });

  const doneQtyByItemIdByIso = new Map<number, Map<string, number>>();
  for (const r of dailyRows) {
    const itemId = Number((r as any).boqItemId);
    if (!Number.isFinite(itemId) || itemId <= 0) continue;
    const dt = (r as any)?.dailyProgress?.progressDate;
    if (!dt) continue;
    const iso = isoFromUtcDate(new Date(dt as any));
    const qty = Number((r as any)?.doneQty || 0);
    if (!doneQtyByItemIdByIso.has(itemId)) doneQtyByItemIdByIso.set(itemId, new Map());
    const m = doneQtyByItemIdByIso.get(itemId)!;
    m.set(iso, (m.get(iso) || 0) + qty);
  }

  const monthExecutedQtyByItemId = new Map<number, number>();
  for (const [itemId, byIso] of doneQtyByItemIdByIso.entries()) {
    let sum = 0;
    for (const v of byIso.values()) sum += Number(v || 0);
    monthExecutedQtyByItemId.set(itemId, sum);
  }

  const wsData: any[][] = [];
  wsData.push(["BOQ Target Report"]);
  wsData.push([
    `BOQ: ${boq.boqNo ?? "-"}${boq.workName ? " - " + safeLabel(boq.workName) : ""}`,
  ]);
  wsData.push([`Site: ${boq.site?.site ?? "-"}`]);
  wsData.push([`Month: ${month}`]);
  wsData.push([`Generated On: ${formatDateTime(new Date())}`]);
  wsData.push([]);

  const fixedHeaders = [
    "Activity ID",
    "BOQ Item",
    "BOQ Qty",
    "Unit",
    "Executed Qty",
    "Remaining Qty",
    "Rate",
    "BOQ Amount",
    "Executed Amount",
    "Remaining Amount",
  ];

  const monthHeader = month.split(" ")[0] || month;

  const monthSpan = 2;
  const headerRow1: any[] = [...fixedHeaders, monthHeader, ""];
  for (const w of weeks) {
    headerRow1.push(w.label, "", "", "");
  }

  const headerRow2: any[] = Array.from({ length: fixedHeaders.length }).map(() => "");
  headerRow2.push("Total Target Qty", "Total Executed Qty");
  for (let i = 0; i < weeks.length; i++) {
    headerRow2.push("Target Qty", "Target Amount", "Executed Qty", "Executed Amount");
  }

  wsData.push(headerRow1);
  wsData.push(headerRow2);

  let totalBoqAmount = 0;
  let totalOrderedAmount = 0;
  let totalRemainingAmount = 0;
  let totalMonthTargetQty = 0;
  let totalMonthExecutedQty = 0;
  const totalTargetAmountByWeekIdx = new Array(weeks.length).fill(0) as number[];
  const totalExecutedAmountByWeekIdx = new Array(weeks.length).fill(0) as number[];

  for (const it of boq.items || []) {
    const isGroup = Boolean((it as any).isGroup);
    const rate = Number((it as any).rate || 0);
    const boqQty = Number((it as any).qty || 0);
    const boqAmount = Number((it as any).amount || boqQty * rate);
    const orderedQty = Number((it as any).orderedQty || 0);
    const remainingQty = Number((it as any).remainingQty || 0);
    const orderedAmount = Number((it as any).orderedValue || orderedQty * rate);
    const remainingAmount = Number((it as any).remainingValue || remainingQty * rate);
    const monthTotalQty = Number(monthTotalQtyByItemId.get(Number(it.id)) || 0);
    const monthExecutedQty = Number(
      monthExecutedQtyByItemId.get(Number(it.id)) || 0
    );

    const row: any[] = [
      it.activityId || "",
      it.item || "",
      Number(fmtQty(boqQty)),
      it.unit?.unitName || "",
      Number(fmtQty(orderedQty)),
      Number(fmtQty(remainingQty)),
      Number(fmtRs(rate)),
      Number(fmtRs(boqAmount)),
      Number(fmtRs(orderedAmount)),
      Number(fmtRs(remainingAmount)),
      Number(fmtQty(monthTotalQty)),
      Number(fmtQty(monthExecutedQty)),
    ];

    for (const w of weeks) {
      const targetQty = Number(byWeekIdByItemId.get(w.id)?.get(Number(it.id)) || 0);
      const execQty = Number(executedByWeekIdByItemId.get(w.id)?.get(Number(it.id)) || 0);
      row.push(
        Number(fmtQty(targetQty)),
        Number(fmtRs(targetQty * rate)),
        Number(fmtQty(execQty)),
        Number(fmtRs(execQty * rate))
      );
    }

    wsData.push(row);

    if (!isGroup) {
      totalBoqAmount += boqAmount;
      totalOrderedAmount += orderedAmount;
      totalRemainingAmount += remainingAmount;
      totalMonthTargetQty += monthTotalQty;
      totalMonthExecutedQty += monthExecutedQty;
      for (let wi = 0; wi < weeks.length; wi++) {
        const w = weeks[wi];
        const targetQty = Number(byWeekIdByItemId.get(w.id)?.get(Number(it.id)) || 0);
        const execQty = Number(executedByWeekIdByItemId.get(w.id)?.get(Number(it.id)) || 0);
        totalTargetAmountByWeekIdx[wi] += targetQty * rate;
        totalExecutedAmountByWeekIdx[wi] += execQty * rate;
      }
    }

    if (isGroup) {
      // keep group row but values still shown (if any)
    }
  }

  const pct = (part: number, whole: number) => {
    if (!whole) return "0.00%";
    return `${((part / whole) * 100).toFixed(2)}%`;
  };

  const totalRow: any[] = [
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    Number(fmtRs(totalBoqAmount)),
    `${fmtRs(totalOrderedAmount)} (${pct(totalOrderedAmount, totalBoqAmount)})`,
    `${fmtRs(totalRemainingAmount)} (${pct(totalRemainingAmount, totalBoqAmount)})`,
    Number(fmtQty(totalMonthTargetQty)),
    Number(fmtQty(totalMonthExecutedQty)),
  ];

  for (let wi = 0; wi < weeks.length; wi++) {
    totalRow.push(
      "",
      `${fmtRs(totalTargetAmountByWeekIdx[wi])} (${pct(totalTargetAmountByWeekIdx[wi], totalBoqAmount)})`,
      "",
      `${fmtRs(totalExecutedAmountByWeekIdx[wi])} (${pct(totalExecutedAmountByWeekIdx[wi], totalBoqAmount)})`
    );
  }
  wsData.push(totalRow);

  const totalRowIndex = wsData.length - 1;

  for (let i = 0; i < 10; i++) wsData.push([]);

  const secondHeaderRowIndex = wsData.length;
  const dailyHeader: any[] = [
    "Activity ID",
    "BOQ Item",
    "BOQ Qty",
    "Executed Qty",
    "Remaining Qty",
    ...monthIsoDays.map((iso) => ddMMyyyyFromIso(iso)),
    "Total Qty",
    "Total Amount",
  ];
  wsData.push(dailyHeader);

  for (const it of boq.items || []) {
    const rate = Number((it as any).rate || 0);
    const boqQty = Number((it as any).qty || 0);
    const orderedQty = Number((it as any).orderedQty || 0);
    const remainingQty = Number((it as any).remainingQty || 0);
    const itemId = Number((it as any).id);
    const byIso = doneQtyByItemIdByIso.get(itemId);

    let totalDone = 0;
    const dayCells = monthIsoDays.map((iso) => {
      const v = byIso?.get(iso);
      if (v == null || Number(v) === 0) return "-";
      totalDone += Number(v);
      return Number(fmtQty(Number(v)));
    });

    const row: any[] = [
      it.activityId || "",
      it.item || "",
      Number(fmtQty(boqQty)),
      Number(fmtQty(orderedQty)),
      Number(fmtQty(remainingQty)),
      ...dayCells,
      Number(fmtQty(totalDone)),
      Number(fmtRs(totalDone * rate)),
    ];
    wsData.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const headerStartRow = 6;
  const fixedEndCol = fixedHeaders.length - 1;
  const monthCol = fixedEndCol + 1;
  const lastCol = monthCol + monthSpan + weeks.length * 4 - 1;

  const blueHeader = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "FF2563EB" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder(),
  } as any;

  const yellowHeader = {
    font: { bold: true, color: { rgb: "FF000000" } },
    fill: { patternType: "solid", fgColor: { rgb: "FFFDE047" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder(),
  } as any;

  const normalBody = {
    alignment: { vertical: "top", wrapText: true },
    border: thinBorder(),
  } as any;

  const yellowBody = {
    fill: { patternType: "solid", fgColor: { rgb: "FFFEF9C3" } },
    alignment: { vertical: "top" },
    border: thinBorder(),
  } as any;

  const totalBody = {
    font: { bold: true },
    border: thinBorder(),
    alignment: { vertical: "top" },
  } as any;

  for (let r = headerStartRow; r <= headerStartRow + 1; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;
      cell.s = { ...(cell.s || {}), ...(c <= fixedEndCol ? blueHeader : yellowHeader) } as any;
    }
  }

  // Second table header styling
  const secondLastCol = dailyHeader.length - 1;
  for (let c = 0; c <= secondLastCol; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: secondHeaderRowIndex, c });
    const cell = (ws as any)[cellRef];
    if (!cell) continue;
    cell.s = { ...(cell.s || {}), ...(c <= 4 ? blueHeader : yellowHeader) } as any;
  }

  const maxCol = Math.max(lastCol, secondLastCol);

  for (let r = headerStartRow + 2; r < wsData.length; r++) {
    if (r === secondHeaderRowIndex) continue;
    for (let c = 0; c <= maxCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;

      const isTotalRow = r === totalRowIndex;
      if (isTotalRow) {
        cell.s = {
          ...(cell.s || {}),
          ...totalBody,
          alignment: {
            ...((cell.s as any)?.alignment || {}),
            ...((totalBody as any)?.alignment || {}),
            wrapText: c === 1 ? true : (cell.s as any)?.alignment?.wrapText,
          },
        } as any;
        continue;
      }

      const isSecondTableBody = r > secondHeaderRowIndex;
      const fixedBoundary = isSecondTableBody ? 4 : fixedEndCol;
      const base = c <= fixedBoundary ? normalBody : yellowBody;
      cell.s = {
        ...(cell.s || {}),
        ...base,
        alignment: {
          ...((cell.s as any)?.alignment || {}),
          ...((base as any)?.alignment || {}),
          wrapText: c === 1 ? true : (cell.s as any)?.alignment?.wrapText,
        },
      } as any;
    }
  }

  // Column widths: cover the max columns across both tables
  ws["!cols"] = Array.from({ length: maxCol + 1 }).map((_, idx) => {
    if (idx === 1) return { wch: 40 };
    if (idx <= 4) return { wch: 12 };
    return { wch: 12 };
  });

  if (!ws["!merges"]) ws["!merges"] = [];
  const merges = ws["!merges"] as any[];
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: maxCol } });

  // Merge fixed headers vertically (two header rows)
  for (let c = 0; c <= fixedEndCol; c++) {
    merges.push({ s: { r: headerStartRow, c }, e: { r: headerStartRow + 1, c } });
  }

  // Month group: merge first header row across monthSpan columns
  merges.push({
    s: { r: headerStartRow, c: monthCol },
    e: { r: headerStartRow, c: monthCol + monthSpan - 1 },
  });

  // Merge each week group label across 4 subcolumns
  for (let i = 0; i < weeks.length; i++) {
    const start = monthCol + monthSpan + i * 4;
    merges.push({ s: { r: headerStartRow, c: start }, e: { r: headerStartRow, c: start + 3 } });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOQ Target");
  const buffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "buffer",
    cellStyles: true,
  });

  const fileName = `boq-target-report-B${boqId}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename=${fileName}`,
      "Cache-Control": "no-store",
    },
  });
}
