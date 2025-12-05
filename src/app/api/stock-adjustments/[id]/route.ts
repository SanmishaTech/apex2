import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/stock-adjustments/[id]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id, 10);
    if (isNaN(id)) return BadRequest("Invalid stock adjustment ID");

    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        siteId: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        stockAdjustmentDetail: {
          select: {
            id: true,
            itemId: true,
            issuedQty: true,
            receivedQty: true,
            rate: true,
            amount: true,
            remarks: true,
            item: {
              select: {
                id: true,
                item: true,
                itemCode: true,
                unit: { select: { id: true, unitName: true } },
              },
            },
          },
        },
      },
    });

    if (!adjustment) return NotFound("Stock adjustment not found");

    // Compute closing stock for the site for items in this adjustment
    try {
      const itemIds = (adjustment.stockAdjustmentDetail || [])
        .map((d: any) => d.itemId)
        .filter((v: any) => typeof v === "number");
      const uniqueItemIds = Array.from(new Set(itemIds));
      let closingStockByItemId: Record<number, number> = {};
      if (uniqueItemIds.length > 0) {
        const sums = await prisma.stockLedger.groupBy({
          by: ["itemId"],
          where: {
            siteId: adjustment.siteId,
            itemId: { in: uniqueItemIds },
          },
          _sum: { receivedQty: true, issuedQty: true },
        } as any);
        for (const row of sums as any[]) {
          const recv = Number(row._sum?.receivedQty ?? 0);
          const issued = Number(row._sum?.issuedQty ?? 0);
          closingStockByItemId[row.itemId] = Number((recv - issued).toFixed(4));
        }
      }
      return Success({ ...adjustment, closingStockByItemId });
    } catch (e) {
      return Success(adjustment);
    }
  } catch (error) {
    console.error("Get stock adjustment error:", error);
    return ApiError("Failed to fetch stock adjustment");
  }
}
