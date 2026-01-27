import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function fmtQty(n: number) {
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
    const labelBase = `Target ${idx + 1}`;
    const label = `${labelBase} (${formatRange(from, to)})`;
    return {
      id: t.id,
      label,
      days,
      details: t.boqTargetDetails || [],
    };
  });

  const byWeekIdByItemId = new Map<number, Map<number, number>>();
  for (const w of weeks) {
    const m = new Map<number, number>();
    for (const d of w.details) {
      const itemId = Number((d as any).BoqItemId);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      const daily = Number((d as any).dailyTargetQty || 0);
      const weeklyTargetQty = daily;
      m.set(itemId, weeklyTargetQty);
    }
    byWeekIdByItemId.set(w.id, m);
  }

  const wsData: any[][] = [];
  wsData.push(["BOQ Target Report"]);
  wsData.push([
    `BOQ: ${boq.boqNo ?? "-"}${boq.workName ? " - " + safeLabel(boq.workName) : ""}`,
  ]);
  wsData.push([`Site: ${boq.site?.site ?? "-"}`]);
  wsData.push([`Month: ${month}`]);
  wsData.push([`Generated On: ${new Date().toLocaleString("en-IN")}`]);
  wsData.push([]);

  const fixedHeaders = [
    "Activity ID",
    "Client Sr No",
    "Description of item",
    "Unit",
    "BOQ QTY",
  ];

  const headerRow: any[] = [...fixedHeaders];
  for (const w of weeks) headerRow.push(w.label);
  headerRow.push("TOTAL");
  wsData.push(headerRow);

  for (const it of boq.items || []) {
    const isGroup = Boolean((it as any).isGroup);
    const row: any[] = [
      it.activityId || "",
      it.clientSrNo || "",
      it.item || "",
      it.unit?.unitName || "",
      Number(fmtQty(Number(it.qty || 0))),
    ];

    let total = 0;
    for (const w of weeks) {
      const m = byWeekIdByItemId.get(w.id);
      const v = Number(m?.get(Number(it.id)) || 0);
      total += v;
      row.push(Number(fmtQty(v)));
    }
    row.push(Number(fmtQty(total)));

    wsData.push(row);

    if (isGroup) {
      // keep group row but values still shown (if any)
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const headerRowIndex = 6;
  const fixedEndCol = fixedHeaders.length - 1;
  const lastCol = fixedEndCol + weeks.length + 1;

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

  for (let c = 0; c <= lastCol; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    const cell = (ws as any)[cellRef];
    if (!cell) continue;
    cell.s = { ...(cell.s || {}), ...(c <= fixedEndCol ? blueHeader : yellowHeader) } as any;
  }

  for (let r = headerRowIndex + 1; r < wsData.length; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;
      const base = c <= fixedEndCol ? normalBody : yellowBody;
      cell.s = {
        ...(cell.s || {}),
        ...base,
        alignment: {
          ...((cell.s as any)?.alignment || {}),
          ...((base as any)?.alignment || {}),
          wrapText: c === 2 ? true : (cell.s as any)?.alignment?.wrapText,
        },
      } as any;
    }
  }

  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
    { wch: 10 },
    { wch: 12 },
    ...Array.from({ length: weeks.length }).map(() => ({ wch: 18 })),
    { wch: 14 },
  ];

  if (!ws["!merges"]) ws["!merges"] = [];
  const merges = ws["!merges"] as any[];
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });

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
