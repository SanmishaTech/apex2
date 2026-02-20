import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/site-item-batches?siteId=1&itemId=2
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const siteIdParam = (searchParams.get("siteId") || "").trim();
    const itemIdParam = (searchParams.get("itemId") || "").trim();

    const siteId = Number(siteIdParam);
    const itemId = itemIdParam ? Number(itemIdParam) : undefined;

    if (!Number.isFinite(siteId) || siteId <= 0) {
      return ApiError("Invalid siteId", 400);
    }

    if (itemIdParam) {
      if (!Number.isFinite(itemId) || (itemId as number) <= 0) {
        return ApiError("Invalid itemId", 400);
      }
    }

    const batches = await prisma.siteItemBatch.findMany({
      where: {
        siteId,
        ...(itemId ? { itemId } : {}),
      },
      select: {
        id: true,
        itemId: true,
        batchNumber: true,
        expiryDate: true,
        openingQty: true,
        batchOpeningRate: true,
        openingValue: true,
      },
      orderBy: [{ itemId: "asc" }, { batchNumber: "asc" }, { id: "asc" }],
    });

    return Success({ data: batches });
  } catch (error) {
    console.error("Get site item batches error:", error);
    return ApiError("Failed to fetch site item batches");
  }
}
