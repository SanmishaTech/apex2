import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

function fmtRs(n: number) {
  return Number(n || 0).toFixed(2);
}

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

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_BOQ_BILLS]);
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
          item: true,
          unit: { select: { unitName: true } },
          qty: true,
          rate: true,
          amount: true,
        },
      },
    },
  });

  if (!boq) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  const doneAgg = await prisma.dailyProgressDetail.groupBy({
    by: ["boqItemId"],
    _sum: { doneQty: true },
    where: {
      dailyProgress: {
        boqId,
      },
    },
  });
  const doneQtyByItemId = new Map<number, number>();
  for (const r of doneAgg) {
    doneQtyByItemId.set(
      Number(r.boqItemId),
      Number((r as any)?._sum?.doneQty || 0)
    );
  }

  const bills = await prisma.bOQBill.findMany({
    where: { boqId },
    orderBy: [{ billDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      billNumber: true,
      billName: true,
      billDate: true,
      boqBillDetails: {
        select: {
          boqItemId: true,
          qty: true,
          amount: true,
        },
      },
    },
  });

  const billMeta = bills.map((b) => {
    const labelBase = (b.billName || "").trim() || (b.billNumber || "").trim() || `Bill ${b.id}`;
    const date = b.billDate ? new Date(b.billDate as any).toLocaleDateString("en-GB") : "";
    const label = date ? `${labelBase} (${date})` : labelBase;
    return { id: b.id, label };
  });

  const billTotalsById = new Map<number, { qty: number; amount: number }>();
  for (const b of billMeta) billTotalsById.set(b.id, { qty: 0, amount: 0 });

  const byItemId = new Map<
    number,
    { totalQty: number; totalAmount: number; byBillId: Map<number, { qty: number; amount: number }> }
  >();
  for (const b of bills) {
    for (const d of b.boqBillDetails || []) {
      const itemId = Number(d.boqItemId);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      const qty = Number(d.qty || 0);
      const amount = Number(d.amount || 0);

      const bt = billTotalsById.get(b.id);
      if (bt) {
        bt.qty += qty;
        bt.amount += amount;
      }

      if (!byItemId.has(itemId)) {
        byItemId.set(itemId, { totalQty: 0, totalAmount: 0, byBillId: new Map() });
      }
      const rec = byItemId.get(itemId)!;
      rec.totalQty += qty;
      rec.totalAmount += amount;
      const prev = rec.byBillId.get(b.id) || { qty: 0, amount: 0 };
      rec.byBillId.set(b.id, { qty: prev.qty + qty, amount: prev.amount + amount });
    }
  }

  const wsData: any[][] = [];
  wsData.push(["BOQ Bills Report"]);
  wsData.push([`BOQ: ${boq.boqNo ?? "-"}${boq.workName ? " - " + boq.workName : ""}`]);
  wsData.push([`Site: ${boq.site?.site ?? "-"}`]);
  wsData.push([`Generated On: ${new Date().toLocaleString("en-IN")}`]);
  wsData.push([]);

  const fixedHeaders = [
    "Description of item",
    "Unit",
    "BOQ QTY",
    "Rate",
    "BOQ AMOUNT",
    "Done Qty",
    "Unbilled Qty",
  ];
  const headerRow1: any[] = [...fixedHeaders, "Total Upto date billed", ""];
  for (const b of billMeta) headerRow1.push(b.label, "");

  const headerRow2: any[] = ["", "", "", "", "", "", "", "Qty", "Amount"];
  for (let i = 0; i < billMeta.length; i++) headerRow2.push("Qty", "Amount");

  wsData.push(headerRow1);
  wsData.push(headerRow2);

  for (const it of boq.items || []) {
    const billed = byItemId.get(Number(it.id));
    const totalQty = Number(fmtQty(billed?.totalQty || 0));
    const totalAmt = Number(fmtRs(billed?.totalAmount || 0));

    const doneQty = Number(fmtQty(doneQtyByItemId.get(Number(it.id)) || 0));
    const unbilledQty = Number(fmtQty(doneQty - totalQty));

    const row: any[] = [
      it.item || "",
      it.unit?.unitName || "",
      Number(fmtQty(Number(it.qty || 0))),
      Number(fmtRs(Number(it.rate || 0))),
      Number(fmtRs(Number(it.amount || 0))),
      doneQty,
      unbilledQty,
      totalQty,
      totalAmt,
    ];

    for (const b of billMeta) {
      const v = billed?.byBillId.get(b.id);
      row.push(Number(fmtQty(v?.qty || 0)), Number(fmtRs(v?.amount || 0)));
    }
    wsData.push(row);
  }

  const totalBoqQty = (boq.items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
  const totalBoqAmount = (boq.items || []).reduce((s, it) => s + Number(it.amount || 0), 0);
  const totalDoneQty = (boq.items || []).reduce(
    (s, it) => s + Number(doneQtyByItemId.get(Number(it.id)) || 0),
    0
  );
  let totalUptoQty = 0;
  let totalUptoAmount = 0;
  for (const v of byItemId.values()) {
    totalUptoQty += Number(v.totalQty || 0);
    totalUptoAmount += Number(v.totalAmount || 0);
  }

  const totalUnbilledQty = totalDoneQty - totalUptoQty;

  const totalRow: any[] = [
    "TOTAL",
    "",
    Number(fmtQty(totalBoqQty)),
    "",
    Number(fmtRs(totalBoqAmount)),
    Number(fmtQty(totalDoneQty)),
    Number(fmtQty(totalUnbilledQty)),
    Number(fmtQty(totalUptoQty)),
    Number(fmtRs(totalUptoAmount)),
  ];
  for (const b of billMeta) {
    const bt = billTotalsById.get(b.id) || { qty: 0, amount: 0 };
    totalRow.push(Number(fmtQty(bt.qty)), Number(fmtRs(bt.amount)));
  }
  wsData.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const headerStartRow = 5;
  const dataStartRow = 7;
  const fixedEndCol = fixedHeaders.length - 1;
  const lastCol = fixedEndCol + 2 + billMeta.length * 2;

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

  const yellowHeaderNormal = {
    ...yellowHeader,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  } as any;

  const yellowBody = {
    fill: { patternType: "solid", fgColor: { rgb: "FFFEF9C3" } },
    alignment: { vertical: "top" },
    border: thinBorder(),
  } as any;

  const normalBody = {
    alignment: { vertical: "top" },
    border: thinBorder(),
  } as any;

  for (let r = headerStartRow; r <= headerStartRow + 1; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;
      if (c <= fixedEndCol) {
        cell.s = { ...(cell.s || {}), ...blueHeader } as any;
      } else {
        cell.s = { ...(cell.s || {}), ...yellowHeaderNormal } as any;
      }
    }
  }

  const totalsRowIndex = wsData.length - 1;
  for (let r = dataStartRow; r < wsData.length; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = (ws as any)[cellRef];
      if (!cell) continue;

      const base = c <= fixedEndCol ? normalBody : yellowBody;
      cell.s = {
        ...(cell.s || {}),
        ...base,
        font: {
          ...((cell.s as any)?.font || {}),
          ...(r === totalsRowIndex ? { bold: true } : {}),
        },
        alignment: {
          ...((cell.s as any)?.alignment || {}),
          ...((base as any)?.alignment || {}),
          wrapText: c === 0 ? true : (cell.s as any)?.alignment?.wrapText,
        },
      } as any;
    }
  }

  const colWidths: Array<{ wch: number }> = [
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
  ];
  for (let i = 0; i < billMeta.length; i++) {
    colWidths.push({ wch: 10 }, { wch: 12 });
  }
  ws["!cols"] = colWidths;

  if (!ws["!merges"]) ws["!merges"] = [];
  const merges = ws["!merges"] as any[];
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });

  for (let c = 0; c <= fixedEndCol; c++) {
    merges.push({ s: { r: headerStartRow, c }, e: { r: headerStartRow + 1, c } });
  }
  merges.push({ s: { r: headerStartRow, c: fixedEndCol + 1 }, e: { r: headerStartRow, c: fixedEndCol + 2 } });
  let start = fixedEndCol + 3;
  for (let i = 0; i < billMeta.length; i++) {
    merges.push({ s: { r: headerStartRow, c: start }, e: { r: headerStartRow, c: start + 1 } });
    start += 2;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOQ Bills");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });

  const fileName = `boq-bills-report-B${boqId}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename=${fileName}`,
      "Cache-Control": "no-store",
    },
  });
}
