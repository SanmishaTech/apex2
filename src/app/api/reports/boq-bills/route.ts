import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

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
          isGroup: true,
        },
      },
    },
  });

  if (!boq) {
    return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
  }

  const bills = await prisma.bOQBill.findMany({
    where: { boqId },
    orderBy: [{ billDate: "asc" }, { id: "asc" }],
    select: {
      id: true,
      billNumber: true,
      billName: true,
      billDate: true,
      totalBillAmount: true,
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
    return {
      id: b.id,
      billNumber: b.billNumber,
      billName: b.billName,
      billDate: b.billDate,
      label,
      totalBillAmount: Number(b.totalBillAmount || 0),
    };
  });

  const byItemId = new Map<number, { totalQty: number; totalAmount: number; byBillId: Map<number, { qty: number; amount: number }> }>();

  for (const b of bills) {
    for (const d of b.boqBillDetails || []) {
      const itemId = Number(d.boqItemId);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;

      const qty = Number(d.qty || 0);
      const amount = Number(d.amount || 0);

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

  const rows = (boq.items || []).map((it) => {
    const k = Number(it.id);
    const billed = byItemId.get(k);
    const total = {
      qty: Number((billed?.totalQty || 0).toFixed(2)),
      amount: Number((billed?.totalAmount || 0).toFixed(2)),
    };

    const billsById: Record<string, { qty: number; amount: number }> = {};
    for (const b of billMeta) {
      const v = billed?.byBillId.get(b.id);
      billsById[String(b.id)] = {
        qty: Number((v?.qty || 0).toFixed(2)),
        amount: Number((v?.amount || 0).toFixed(2)),
      };
    }

    return {
      boqItemId: it.id,
      description: it.item || "",
      unit: it.unit?.unitName || "",
      boqQty: Number(Number(it.qty || 0).toFixed(4)),
      rate: Number(Number(it.rate || 0).toFixed(2)),
      boqAmount: Number(Number(it.amount || 0).toFixed(2)),
      totalUpto: total,
      bills: billsById,
      isGroup: Boolean((it as any).isGroup),
    };
  });

  return NextResponse.json({
    meta: {
      boqId: boq.id,
      boqNo: boq.boqNo,
      workName: boq.workName,
      site: boq.site,
    },
    bills: billMeta,
    rows,
  });
}
