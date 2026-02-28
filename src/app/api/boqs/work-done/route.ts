import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

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

    return Success({
      data,
      totals: {
        amount: totalAmount,
        orderedAmount: totalOrderedAmount,
        remainingAmount: totalRemainingAmount,
        orderedPctTotal,
        remainingPctTotal,
      },
    });
  } catch (error) {
    console.error("Get work-done list error:", error);
    return ApiError("Failed to fetch work-done list");
  }
}
