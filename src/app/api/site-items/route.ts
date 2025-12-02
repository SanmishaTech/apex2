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
    if (!Number.isFinite(siteId) || siteId <= 0) {
      return BadRequest("siteId is required");
    }

    const siteItems = await prisma.siteItem.findMany({
      where: { siteId },
      select: { itemId: true, closingStock: true },
    });

    const data = siteItems.map((si) => ({
      itemId: si.itemId,
      closingStock: Number(si.closingStock || 0),
    }));

    return Success({ data });
  } catch (error) {
    console.error("Get site items error:", error);
    return ApiError("Failed to fetch site items");
  }
}
