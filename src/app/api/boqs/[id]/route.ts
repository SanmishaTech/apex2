import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/boqs/:id
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error("Invalid id", 400);
  try {
    const { searchParams } = new URL(req.url);
    const excludeBoqBillIdRaw = searchParams.get("excludeBoqBillId");
    const excludeBoqBillId = excludeBoqBillIdRaw ? Number(excludeBoqBillIdRaw) : NaN;
    const excludeBillId = Number.isFinite(excludeBoqBillId) && excludeBoqBillId > 0 ? excludeBoqBillId : null;

    const boq = await prisma.boq.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        boqNo: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        workName: true,
        workOrderNo: true,
        workOrderDate: true,
        startDate: true,
        endDate: true,
        totalWorkValue: true,
        gstRate: true,
        agreementNo: true,
        agreementStatus: true,
        completionPeriod: true,
        completionDate: true,
        dateOfExpiry: true,
        commencementDate: true,
        timeExtensionDate: true,
        defectLiabilityPeriod: true,
        performanceSecurityMode: true,
        performanceSecurityDocumentNo: true,
        performanceSecurityPeriod: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            activityId: true,
            clientSrNo: true,
            item: true,
            unitId: true,
            unit: { select: { unitName: true } },
            qty: true,
            rate: true,
            amount: true,
            orderedQty: true,
            orderedValue: true,
            remainingQty: true,
            remainingValue: true,
            isGroup: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!boq) return Error("BOQ not found", 404);

    const billedDetails = await prisma.bOQBillDetail.findMany({
      where: {
        boqBill: {
          boqId: idNum,
          ...(excludeBillId ? { id: { not: excludeBillId } } : {}),
        },
      },
      select: { boqItemId: true, qty: true },
    });

    const billedQtyByItemId = new Map<number, number>();
    for (const d of billedDetails) {
      const k = Number(d.boqItemId);
      const v = Number(d.qty || 0);
      billedQtyByItemId.set(k, (billedQtyByItemId.get(k) || 0) + v);
    }

    const items = (boq.items || []).map((it) => ({
      ...it,
      billedQty: Number(billedQtyByItemId.get(Number(it.id)) || 0),
    }));

    return Success({ ...boq, items });
  } catch {
    return Error("Failed to fetch BOQ");
  }
}

// DELETE /api/boqs/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error("Invalid id", 400);
  try {
    await prisma.boq.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2025") return Error("BOQ not found", 404);
    return Error("Failed to delete BOQ");
  }
}
