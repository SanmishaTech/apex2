import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, BadRequest, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/site-items?siteId=123
// Returns closing stock per item for the given site
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const siteIdStr = searchParams.get("siteId");
    const siteId = siteIdStr ? parseInt(siteIdStr, 10) : NaN;
    const includeBatches = searchParams.get("includeBatches") === "1";
    if (!Number.isFinite(siteId) || siteId <= 0) {
      return BadRequest("siteId is required");
    }

    const siteItems = await prisma.siteItem.findMany({
      where: { siteId },
      select: {
        itemId: true,
        openingStock: true,
        openingRate: true,
        openingValue: true,
        closingStock: true,
        unitRate: true,
        closingValue: true,
        item: {
          select: {
            id: true,
            item: true,
            itemCode: true,
            isExpiryDate: true,
            unit: { select: { unitName: true } },
          },
        },
        siteItemBatches: includeBatches
          ? {
              select: {
                id: true,
                batchNumber: true,
                expiryDate: true,
                closingQty: true,
                unitRate: true,
                closingValue: true,
              },
              orderBy: [{ batchNumber: "asc" }],
            }
          : false,
      },
    });

    const data = siteItems.map((si) => ({
      itemId: si.itemId,
      openingStock: Number(si.openingStock || 0),
      openingRate: Number(si.openingRate || 0),
      openingValue: Number(si.openingValue || 0),
      closingStock: Number(si.closingStock || 0),
      unitRate: Number(si.unitRate || 0),
      closingValue: Number(si.closingValue || 0),
      item: si.item
        ? {
            id: si.item.id,
            item: si.item.item,
            itemCode: si.item.itemCode,
            isExpiryDate: Boolean((si.item as any).isExpiryDate),
            unit: si.item.unit ? { unitName: si.item.unit.unitName } : null,
          }
        : null,
      siteItemBatches: includeBatches
        ? ((si as any).siteItemBatches || []).map((b: any) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate,
            closingQty: Number(b.closingQty || 0),
            unitRate: Number(b.unitRate || 0),
            closingValue: Number(b.closingValue || 0),
          }))
        : undefined,
    }));

    return Success({ data });
  } catch (error) {
    console.error("Get site items error:", error);
    return ApiError("Failed to fetch site items");
  }
}
