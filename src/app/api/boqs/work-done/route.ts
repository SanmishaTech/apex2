import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

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

function monthStartUtc(y: number, mo: number) {
  return new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
}

function daysInMonthUtc(y: number, mo: number) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function monthEndUtc(y: number, mo: number) {
  // End of month: next month start minus 1ms
  const next = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  return new Date(next.getTime() - 1);
}

function monthLabel(y: number, mo: number) {
  const d = new Date(Date.UTC(y, mo - 1, 1));
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function fmtDateDDMMYYYYUtc(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
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
    if (out.length > 60) break; // safety
  }
  return out;
}

// GET /api/boqs/work-done
// Returns all BOQ items with ordered/remaining fields for a BOQ (no pagination)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const boqIdParam = searchParams.get("boqId");
    const search = (searchParams.get("search") || "").trim();
    const siteIdParam = searchParams.get("siteId");
    const fromMonthParam = searchParams.get("fromMonth");
    const toMonthParam = searchParams.get("toMonth");
    const siteId = siteIdParam ? Number(siteIdParam) : undefined;
    const boqId = boqIdParam ? Number(boqIdParam) : undefined;

    if (!Number.isFinite(boqId)) {
      return ApiError("boqId is required", 400);
    }

    // Build where clause on BoqItem with relations
    const where: any = {};
    if (Number.isFinite(boqId as number)) {
      where.boqId = boqId;
    }

    // Restrict to assigned sites for non-admin users
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

    if (search) {
      where.OR = [
        { boq: { boqNo: { contains: search } } },
        { item: { contains: search } },
      ];
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
            siteId: true,
            site: { select: { site: true } },
          },
        },
      },
      orderBy: [{ id: "asc" }],
    });

    const dpAgg = await prisma.dailyProgressDetail.groupBy({
      by: ["boqItemId"],
      _sum: { doneQty: true },
      where: {
        boqItemId: { in: rows.map((r) => r.id) },
        dailyProgress: {
          boqId: boqId as number,
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

    let totalAmount = 0;
    let totalOrderedAmount = 0;
    let totalRemainingAmount = 0;
    const data = rows.map((r) => {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const orderedQty = Number(r.orderedQty || 0);
      const dpDoneQty = Number(dpDoneByItemId.get(r.id) || 0);
      const executedQty = orderedQty + dpDoneQty;
      const remainingQty = qty - executedQty;
      const amount = Number(r.amount || 0);
      const orderedAmount = executedQty * rate;
      const remainingAmount = remainingQty * rate;
      return {
        id: r.id,
        boqId: r.boqId,
        clientSrNo: r.clientSrNo || null,
        boqNo: r.boq?.boqNo || "",
        siteId: r.boq?.siteId ?? null,
        site: r.boq?.site?.site || "-",
        itemId: r.id, // no separate item ID in BoqItem, keep line id
        description: r.item || "",
        qty,
        unit: r.unit?.unitName || null,
        orderedQty: executedQty,
        remainingQty,
        rate,
        amount,
        orderedAmount,
        remainingAmount,
        orderedPct: qty === 0 ? 0 : (executedQty / qty) * 100,
        remainingPct: qty === 0 ? 0 : (remainingQty / qty) * 100,
      };
    });

    data.forEach((d) => {
      totalAmount += d.amount;
      totalOrderedAmount += d.orderedAmount;
      totalRemainingAmount += d.remainingAmount;
    });
    const orderedPctTotal =
      totalAmount === 0 ? 0 : (totalOrderedAmount / totalAmount) * 100;
    const remainingPctTotal =
      totalAmount === 0 ? 0 : (totalRemainingAmount / totalAmount) * 100;

    // Monthly cumulative sections (optional)
    const fromMonth = parseMonthParam(fromMonthParam);
    const toMonth = parseMonthParam(toMonthParam);
    let monthly: any[] = [];
    if (fromMonth && toMonth) {
      const months = listMonths(fromMonth, toMonth);
      // Build cumulative doneQty by month-end per BOQ item
      const dpMonthlyAgg = await prisma.dailyProgressDetail.groupBy({
        by: ["boqItemId", "dailyProgressId"],
        _sum: { doneQty: true },
        where: {
          boqItemId: { in: rows.map((r) => r.id) },
          dailyProgress: {
            boqId: boqId as number,
            ...(Number.isFinite(siteId as number) ? { siteId: siteId as number } : {}),
          },
        },
      });

      // We need progressDate for each dailyProgressId; load minimal map.
      const dpIds = Array.from(new Set(dpMonthlyAgg.map((x) => Number((x as any).dailyProgressId))));
      const dpDates = dpIds.length
        ? await prisma.dailyProgress.findMany({
            where: { id: { in: dpIds } },
            select: { id: true, progressDate: true },
          })
        : [];
      const dateByDpId = new Map<number, Date>();
      dpDates.forEach((d) => dateByDpId.set(Number(d.id), d.progressDate as any));

      // Prepare per item list of (date, qty)
      const entriesByItem = new Map<
        number,
        Array<{ dt: number; qty: number; dateStr: string }>
      >();
      for (const r of dpMonthlyAgg as any[]) {
        const itemId = Number(r.boqItemId);
        const dpId = Number(r.dailyProgressId);
        const dt = dateByDpId.get(dpId);
        if (!dt) continue;
        const qty = Number(r?._sum?.doneQty || 0);
        if (!(qty > 0)) continue;
        const dateStr = fmtDateDDMMYYYYUtc(dt);
        const list = entriesByItem.get(itemId) || [];
        list.push({ dt: dt.getTime(), qty, dateStr });
        entriesByItem.set(itemId, list);
      }
      for (const [k, list] of entriesByItem.entries()) {
        list.sort((a, b) => a.dt - b.dt);
      }

      // For each month, compute cumulative doneQty up to month end
      monthly = months.map(({ y, mo }) => {
        const start = monthStartUtc(y, mo);
        const startTs = start.getTime();
        const end = monthEndUtc(y, mo);
        const endTs = end.getTime();

        // Return all calendar dates of the month (even if daily progress doesn't exist)
        const dim = daysInMonthUtc(y, mo);
        const dates = Array.from({ length: dim }).map((_, i) => {
          const d = new Date(Date.UTC(y, mo - 1, i + 1, 0, 0, 0, 0));
          return fmtDateDDMMYYYYUtc(d);
        });

        let mTotalAmount = 0;
        let mTotalOrderedAmount = 0;
        let mTotalRemainingAmount = 0;

        // Build map of overall values by item id for quick lookup
        const overallByItemId = new Map<number, { remainingQty: number; remainingAmount: number; remainingPct: number }>();
        for (const d of data) {
          overallByItemId.set(d.id, {
            remainingQty: d.remainingQty,
            remainingAmount: d.remainingAmount,
            remainingPct: d.remainingPct,
          });
        }

        const mData = rows.map((r) => {
          const qty = Number(r.qty || 0);
          const rate = Number(r.rate || 0);
          const orderedQty = Number(r.orderedQty || 0);
          const list = entriesByItem.get(r.id) || [];
          let monthDone = 0;
          const dailyDone: Record<string, number> = {};
          for (const e of list) {
            if (e.dt >= startTs && e.dt <= endTs) {
              monthDone += Number(e.qty || 0);
              dailyDone[e.dateStr] = Number(dailyDone[e.dateStr] || 0) + Number(e.qty || 0);
            }
          }
          const executedQty = orderedQty + monthDone;
          const remainingQty = qty - executedQty;
          const amount = Number(r.amount || 0);
          const orderedAmount = executedQty * rate;
          const remainingAmount = remainingQty * rate;

          mTotalAmount += amount;
          mTotalOrderedAmount += orderedAmount;
          mTotalRemainingAmount += remainingAmount;

          // Get overall remaining values for this item
          const overall = overallByItemId.get(r.id);

          return {
            id: r.id,
            boqId: r.boqId,
            clientSrNo: r.clientSrNo || null,
            boqNo: r.boq?.boqNo || "",
            siteId: r.boq?.siteId ?? null,
            site: r.boq?.site?.site || "-",
            itemId: r.id,
            description: r.item || "",
            qty,
            unit: r.unit?.unitName || null,
            orderedQty: executedQty,
            remainingQty: overall?.remainingQty ?? remainingQty, // Use overall remaining
            rate,
            amount,
            orderedAmount,
            remainingAmount: overall?.remainingAmount ?? remainingAmount, // Use overall remaining
            orderedPct: qty === 0 ? 0 : (executedQty / qty) * 100,
            remainingPct: overall?.remainingPct ?? (qty === 0 ? 0 : (remainingQty / qty) * 100), // Use overall remaining
            dailyDone,
          };
        });

        const orderedPctTotal =
          mTotalAmount === 0 ? 0 : (mTotalOrderedAmount / mTotalAmount) * 100;
        const remainingPctTotal =
          mTotalAmount === 0 ? 0 : (mTotalRemainingAmount / mTotalAmount) * 100;

        // Calculate overall remaining amount and percentage for monthly totals display
        const overallRemainingAmountTotal = data.reduce((sum, d) => sum + d.remainingAmount, 0);
        const overallRemainingPctTotal = totalAmount === 0 ? 0 : (overallRemainingAmountTotal / totalAmount) * 100;

        return {
          month: `${String(y)}-${String(mo).padStart(2, "0")}`,
          label: monthLabel(y, mo),
          dates,
          data: mData,
          totals: {
            amount: mTotalAmount,
            orderedAmount: mTotalOrderedAmount,
            remainingAmount: overallRemainingAmountTotal, // Overall remaining amount
            orderedPctTotal,
            remainingPctTotal: overallRemainingPctTotal, // Overall remaining percentage
          },
        };
      });
    }

    return Success({
      data,
      totals: {
        amount: totalAmount,
        orderedAmount: totalOrderedAmount,
        remainingAmount: totalRemainingAmount,
        orderedPctTotal,
        remainingPctTotal,
      },
      monthly,
    });
  } catch (error) {
    console.error("Get work-done list error:", error);
    return ApiError("Failed to fetch work-done list");
  }
}
