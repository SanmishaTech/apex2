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

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const sp = req.nextUrl.searchParams;
    const boqIdRaw = sp.get("boqId");
    const boqId = boqIdRaw ? Number(boqIdRaw) : NaN;

    if (!boqIdRaw || Number.isNaN(boqId) || boqId <= 0) {
      return NextResponse.json({ error: "boqId is required" }, { status: 400 });
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

    const wsData: any[][] = [];
    wsData.push(["Work Done"]);
    wsData.push([
      `BOQ: ${safeLabel(boqNo)}${workName ? " - " + safeLabel(workName) : ""}`,
    ]);
    wsData.push([`Site: ${safeLabel(siteName)}`]);
    wsData.push([`Generated On: ${formatGeneratedOn(new Date())}`]);
    wsData.push([]);

    const headerRowIdx = wsData.length;
    wsData.push([
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
    ]);

    for (const r of data) {
      wsData.push([
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
    }

    const totalsRowIdx = wsData.length;
    wsData.push([
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      Number(fmt2(totalAmount)),
      Number(fmt2(totalExecutedAmount)),
      Number(fmt2(totalRemainingAmount)),
      Number(fmt2(executedPctTotal)),
      Number(fmt2(remainingPctTotal)),
    ]);

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

    const lastCol = wsData[headerRowIdx].length - 1;

    if (!ws["!merges"]) ws["!merges"] = [];
    const merges = ws["!merges"] as any[];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } });
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } });

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
        if (R >= 1 && R <= 3) {
          cell.s = metaStyle;
          continue;
        }
        if (R === headerRowIdx) {
          cell.s = blueHeader;
          continue;
        }
        if (R === totalsRowIdx) {
          cell.s = totalBody;
          continue;
        }

        const isNumericCol = C >= 2; // qty onwards
        cell.s = isNumericCol ? rightBody : normalBody;
      }
    }

    // Column widths tuned to look like UI
    ws["!cols"] = [
      { wch: 14 }, // Client Sr. No.
      { wch: 45 }, // Description
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
    ];

    ws["!freeze"] = { xSplit: 2, ySplit: headerRowIdx + 1 } as any;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Work Done");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="work-done-${String(boqNo).replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("work-done-excel error:", error);
    return NextResponse.json({ error: "Failed to generate excel" }, { status: 500 });
  }
}
