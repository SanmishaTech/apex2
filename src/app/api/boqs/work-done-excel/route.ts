import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

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

function safeLabel(s: string) {
  return String(s || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function formatGeneratedOn(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${sec} ${ampm}`;
}

function parseMonthParam(v: string | null) {
  if (!v) return null;
  const m = String(v).trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const [yStr, moStr] = m.split("-");
  const y = Number(yStr);
  const mo = Number(moStr);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return { y, mo };
}

function monthEndUtc(y: number, mo: number) {
  const next = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  return new Date(next.getTime() - 1);
}

function daysInMonthUtc(y: number, mo: number) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function fmtDateDDMMYYYYUtc(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function monthLabel(y: number, mo: number) {
  const d = new Date(Date.UTC(y, mo - 1, 1));
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function listMonths(from: { y: number; mo: number }, to: { y: number; mo: number }) {
  const out: Array<{ y: number; mo: number }> = [];
  let y = from.y;
  let m = from.mo;
  while (y < to.y || (y === to.y && m <= to.mo)) {
    out.push({ y, mo: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 60) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const sp = req.nextUrl.searchParams;
    const boqIdRaw = sp.get("boqId");
    const boqId = boqIdRaw ? Number(boqIdRaw) : NaN;
    const fromMonthParam = sp.get("fromMonth");
    const toMonthParam = sp.get("toMonth");

    if (!boqIdRaw || Number.isNaN(boqId) || boqId <= 0) {
      return NextResponse.json({ error: "boqId is required" }, { status: 400 });
    }

    const fromMonth = parseMonthParam(fromMonthParam);
    const toMonth = parseMonthParam(toMonthParam);
    if (!fromMonth || !toMonth) {
      return NextResponse.json(
        { error: "fromMonth and toMonth are required (YYYY-MM)" },
        { status: 400 }
      );
    }
    if (`${fromMonth.y}-${String(fromMonth.mo).padStart(2, "0")}` > `${toMonth.y}-${String(toMonth.mo).padStart(2, "0")}`) {
      return NextResponse.json(
        { error: "fromMonth cannot be greater than toMonth" },
        { status: 400 }
      );
    }

    const siteIdParam = sp.get("siteId");
    const siteId = siteIdParam ? Number(siteIdParam) : undefined;

    const where: any = { boqId };

    // Restrict to assigned sites for non-admin users (matches /api/boqs/work-done)
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      if (Number.isFinite(siteId as number)) {
        const sid = siteId as number;
        where.boq = {
          siteId: { in: assignedSiteIds.includes(sid) ? [sid] : [-1] },
        };
      } else {
        where.boq = {
          siteId: { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] },
        };
      }
    } else if (Number.isFinite(siteId as number)) {
      where.boq = { siteId };
    }

    const rows = await prisma.boqItem.findMany({
      where,
      select: {
        id: true,
        boqId: true,
        clientSrNo: true,
        item: true,
        qty: true,
        rate: true,
        amount: true,
        orderedQty: true,
        orderedValue: true,
        unit: { select: { unitName: true } },
        boq: {
          select: {
            id: true,
            boqNo: true,
            workName: true,
            siteId: true,
            site: { select: { site: true } },
          },
        },
      },
      orderBy: [{ id: "asc" }],
    });

    if (!rows.length) {
      return NextResponse.json(
        { error: "No rows found for selected BOQ" },
        { status: 404 }
      );
    }

    const dpAgg = await prisma.dailyProgressDetail.groupBy({
      by: ["boqItemId"],
      _sum: { doneQty: true },
      where: {
        boqItemId: { in: rows.map((r) => r.id) },
        dailyProgress: {
          boqId,
          ...(Number.isFinite(siteId as number) ? { siteId: siteId as number } : {}),
        },
      },
    });

    const dpDoneByItemId = new Map<number, number>();
    for (const r of dpAgg) {
      dpDoneByItemId.set(
        Number((r as any).boqItemId),
        Number((r as any)?._sum?.doneQty || 0)
      );
    }

    type ExportRow = {
      clientSrNo: string;
      description: string;
      qty: number;
      unit: string;
      executedQty: number;
      remainingQty: number;
      rate: number;
      amount: number;
      executedAmount: number;
      remainingAmount: number;
      executedPct: number;
      remainingPct: number;
    };

    const data: ExportRow[] = rows.map((r) => {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const orderedQty = Number(r.orderedQty || 0);
      const dpDoneQty = Number(dpDoneByItemId.get(r.id) || 0);
      const executedQty = orderedQty + dpDoneQty;
      const remainingQty = qty - executedQty;
      const amount = Number(r.amount || 0);
      const executedAmount = executedQty * rate;
      const remainingAmount = remainingQty * rate;
      const executedPct = qty === 0 ? 0 : (executedQty / qty) * 100;
      const remainingPct = qty === 0 ? 0 : (remainingQty / qty) * 100;
      return {
        clientSrNo: r.clientSrNo || "-",
        description: r.item || "",
        qty,
        unit: r.unit?.unitName || "-",
        executedQty,
        remainingQty,
        rate,
        amount,
        executedAmount,
        remainingAmount,
        executedPct,
        remainingPct,
      };
    });

    let totalAmount = 0;
    let totalExecutedAmount = 0;
    let totalRemainingAmount = 0;
    for (const r of data) {
      totalAmount += r.amount;
      totalExecutedAmount += r.executedAmount;
      totalRemainingAmount += r.remainingAmount;
    }

    const executedPctTotal = totalAmount === 0 ? 0 : (totalExecutedAmount / totalAmount) * 100;
    const remainingPctTotal = totalAmount === 0 ? 0 : (totalRemainingAmount / totalAmount) * 100;

    const boqNo = rows[0]?.boq?.boqNo || `BOQ ${boqId}`;
    const workName = rows[0]?.boq?.workName || "";
    const siteName = rows[0]?.boq?.site?.site || "-";

    // Monthly cumulative sections
    const months = listMonths(fromMonth, toMonth).reverse();
    const dpMonthlyAgg = await prisma.dailyProgressDetail.groupBy({
      by: ["boqItemId", "dailyProgressId"],
      _sum: { doneQty: true },
      where: {
        boqItemId: { in: rows.map((r) => r.id) },
        dailyProgress: {
          boqId,
          ...(Number.isFinite(siteId as number) ? { siteId: siteId as number } : {}),
        },
      },
    });

    const dpIds = Array.from(
      new Set(dpMonthlyAgg.map((x) => Number((x as any).dailyProgressId)))
    );
    const dpDates = dpIds.length
      ? await prisma.dailyProgress.findMany({
          where: { id: { in: dpIds } },
          select: { id: true, progressDate: true },
        })
      : [];
    const dateByDpId = new Map<number, Date>();
    dpDates.forEach((d) => dateByDpId.set(Number(d.id), d.progressDate as any));

    const entriesByItem = new Map<number, Array<{ dt: number; qty: number }>>();
    for (const r of dpMonthlyAgg as any[]) {
      const itemId = Number(r.boqItemId);
      const dpId = Number(r.dailyProgressId);
      const dt = dateByDpId.get(dpId);
      if (!dt) continue;
      const qty = Number(r?._sum?.doneQty || 0);
      if (!(qty > 0)) continue;
      const list = entriesByItem.get(itemId) || [];
      list.push({ dt: dt.getTime(), qty });
      entriesByItem.set(itemId, list);
    }
    for (const [k, list] of entriesByItem.entries()) {
      list.sort((a, b) => a.dt - b.dt);
      entriesByItem.set(k, list);
    }

    const wsData: any[][] = [];
    wsData.push(["Work Done"]);
    wsData.push([
      `BOQ: ${safeLabel(boqNo)}${workName ? " - " + safeLabel(workName) : ""}`,
    ]);
    wsData.push([`Site: ${safeLabel(siteName)}`]);
    wsData.push([`Month Range: ${String(fromMonthParam || "")} to ${String(toMonthParam || "")}`]);
    wsData.push([`Generated On: ${formatGeneratedOn(new Date())}`]);
    wsData.push([]);

    const headerRows = new Set<number>();
    const totalsRows = new Set<number>();
    const sectionTitleRows = new Set<number>();

    function pushTableSection(
      sectionTitle: string | null,
      header: string[],
      bodyRows: any[][],
      totals: {
        amount: number;
        executedAmount: number;
        remainingAmount: number;
        executedPct: number;
        remainingPct: number;
      }
    ) {
      if (sectionTitle) {
        sectionTitleRows.add(wsData.length);
        wsData.push([sectionTitle]);
      }

      const headerRowIdx = wsData.length;
      headerRows.add(headerRowIdx);
      wsData.push(header);

      for (const r of bodyRows) wsData.push(r);

      const totalsRowIdx = wsData.length;
      totalsRows.add(totalsRowIdx);
      const totalsRow: Array<string | number> = Array.from({ length: header.length }).map(
        () => ""
      );
      totalsRow[1] = "TOTAL";
      const idxBoqAmount = header.indexOf("BOQ Amount");
      const idxExecAmount = header.indexOf("Executed Amount");
      const idxRemAmount = header.indexOf("Remaining Amount");
      const idxExecPct = header.indexOf("Executed %");
      const idxRemPct = header.indexOf("Remaining %");
      if (idxBoqAmount >= 0) totalsRow[idxBoqAmount] = Number(fmt2(totals.amount));
      if (idxExecAmount >= 0) totalsRow[idxExecAmount] = Number(fmt2(totals.executedAmount));
      if (idxRemAmount >= 0) totalsRow[idxRemAmount] = Number(fmt2(totals.remainingAmount));
      if (idxExecPct >= 0) totalsRow[idxExecPct] = Number(fmt2(totals.executedPct));
      if (idxRemPct >= 0) totalsRow[idxRemPct] = Number(fmt2(totals.remainingPct));
      wsData.push(totalsRow);

      wsData.push([]);
    }

    sectionTitleRows.add(wsData.length);
    wsData.push(["Total Work Done"]);

    const overallHeader = [
      "Client Sr. No.",
      "BOQ Item Description",
      "BOQ Qty",
      "Unit",
      "Executed Qty",
      "Remaining Qty",
      "Rate",
      "BOQ Amount",
      "Executed Amount",
      "Remaining Amount",
      "Executed %",
      "Remaining %",
    ];
    const overallBody = data.map((r) => [
      r.clientSrNo,
      r.description,
      Number(fmt2(r.qty)),
      r.unit,
      Number(fmt2(r.executedQty)),
      Number(fmt2(r.remainingQty)),
      Number(fmt2(r.rate)),
      Number(fmt2(r.amount)),
      Number(fmt2(r.executedAmount)),
      Number(fmt2(r.remainingAmount)),
      Number(fmt2(r.executedPct)),
      Number(fmt2(r.remainingPct)),
    ]);

    pushTableSection(null, overallHeader, overallBody, {
      amount: totalAmount,
      executedAmount: totalExecutedAmount,
      remainingAmount: totalRemainingAmount,
      executedPct: executedPctTotal,
      remainingPct: remainingPctTotal,
    });

    // Monthly sections (cumulative to month end)
    for (const m of months) {
      const end = monthEndUtc(m.y, m.mo);
      const endTs = end.getTime();
      const dim = daysInMonthUtc(m.y, m.mo);
      const dates = Array.from({ length: dim }).map((_, i) => {
        const d = new Date(Date.UTC(m.y, m.mo - 1, i + 1, 0, 0, 0, 0));
        return fmtDateDDMMYYYYUtc(d);
      });

      let mTotalAmount = 0;
      let mTotalExecutedAmount = 0;
      let mTotalRemainingAmount = 0;

      const monthRows = rows.map((r) => {
        const qty = Number(r.qty || 0);
        const rate = Number(r.rate || 0);
        const orderedQty = Number(r.orderedQty || 0);
        const list = entriesByItem.get(r.id) || [];
        let cumDone = 0;
        const dailyDone: Record<string, number> = {};
        for (const e of list) {
          if (e.dt <= endTs) cumDone += Number(e.qty || 0);
          else break;

          const ds = fmtDateDDMMYYYYUtc(new Date(e.dt));
          dailyDone[ds] = Number(dailyDone[ds] || 0) + Number(e.qty || 0);
        }
        const executedQty = orderedQty + cumDone;
        const remainingQty = qty - executedQty;
        const amount = Number(r.amount || 0);
        const executedAmount = executedQty * rate;
        const remainingAmount = remainingQty * rate;
        const executedPct = qty === 0 ? 0 : (executedQty / qty) * 100;
        const remainingPct = qty === 0 ? 0 : (remainingQty / qty) * 100;
        mTotalAmount += amount;
        mTotalExecutedAmount += executedAmount;
        mTotalRemainingAmount += remainingAmount;

        const dateCells = dates.map((d) => Number(fmt2(Number(dailyDone[d] || 0))));

        return [
          r.clientSrNo || "-",
          r.item || "",
          Number(fmt2(qty)),
          r.unit?.unitName || "-",
          ...dateCells,
          Number(fmt2(executedQty)),
          Number(fmt2(remainingQty)),
          Number(fmt2(rate)),
          Number(fmt2(amount)),
          Number(fmt2(executedAmount)),
          Number(fmt2(remainingAmount)),
          Number(fmt2(executedPct)),
          Number(fmt2(remainingPct)),
        ];
      });

      const mExecPct = mTotalAmount === 0 ? 0 : (mTotalExecutedAmount / mTotalAmount) * 100;
      const mRemPct = mTotalAmount === 0 ? 0 : (mTotalRemainingAmount / mTotalAmount) * 100;

      const monthHeader = [
        "Client Sr. No.",
        "BOQ Item Description",
        "BOQ Qty",
        "Unit",
        ...dates,
        "Executed Qty",
        "Remaining Qty",
        "Rate",
        "BOQ Amount",
        "Executed Amount",
        "Remaining Amount",
        "Executed %",
        "Remaining %",
      ];

      pushTableSection(monthLabel(m.y, m.mo), monthHeader, monthRows, {
        amount: mTotalAmount,
        executedAmount: mTotalExecutedAmount,
        remainingAmount: mTotalRemainingAmount,
        executedPct: mExecPct,
        remainingPct: mRemPct,
      });
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

    const rightBody = {
      alignment: { vertical: "top", horizontal: "right" },
      border: thinBorder(),
    } as any;

    const totalBody = {
      font: { bold: true },
      fill: { patternType: "solid", fgColor: { rgb: "FFF3F4F6" } },
      alignment: { vertical: "center" },
      border: thinBorder(),
    } as any;

    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: "FF111827" } },
      alignment: { horizontal: "center", vertical: "center" },
    } as any;

    const metaStyle = {
      font: { bold: false, color: { rgb: "FF374151" } },
      alignment: { horizontal: "left", vertical: "center" },
    } as any;

    const sectionTitleStyle = {
      font: { bold: true, sz: 12, color: { rgb: "FF111827" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFF9FAFB" } },
      alignment: { horizontal: "left", vertical: "center" },
    } as any;

    const lastCol = Math.max(...wsData.map((r) => (Array.isArray(r) ? r.length : 0))) - 1;

    if (!ws["!merges"]) ws["!merges"] = [];
    const merges = ws["!merges"] as any[];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } });
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } });
    merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } });

    // Merge section title rows
    for (const r of Array.from(sectionTitleRows)) {
      merges.push({ s: { r, c: 0 }, e: { r, c: lastCol } });
    }

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;

        if (R === 0) {
          cell.s = titleStyle;
          continue;
        }
        if (R >= 1 && R <= 4) {
          cell.s = metaStyle;
          continue;
        }
        if (sectionTitleRows.has(R)) {
          cell.s = sectionTitleStyle;
          continue;
        }
        if (headerRows.has(R)) {
          cell.s = blueHeader;
          continue;
        }
        if (totalsRows.has(R)) {
          cell.s = totalBody;
          continue;
        }

        const isNumericCol = C >= 2; // qty onwards
        cell.s = isNumericCol ? rightBody : normalBody;
      }
    }

    // Column widths tuned to look like UI (dates are narrower)
    const cols: Array<{ wch: number }> = [];
    for (let i = 0; i <= lastCol; i++) {
      if (i === 0) cols.push({ wch: 14 });
      else if (i === 1) cols.push({ wch: 45 });
      else if (i === 2) cols.push({ wch: 12 });
      else if (i === 3) cols.push({ wch: 10 });
      else cols.push({ wch: 11 });
    }
    ws["!cols"] = cols;

    // Freeze first column and first table header
    const firstHeaderRow = Math.min(...Array.from(headerRows.values()));
    ws["!freeze"] = { xSplit: 1, ySplit: firstHeaderRow + 1 } as any;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Work Done");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="work-done-${String(boqNo).replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-")}-${String(fromMonthParam)}-to-${String(toMonthParam)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("work-done-excel error:", error);
    return NextResponse.json({ error: "Failed to generate excel" }, { status: 500 });
  }
}
