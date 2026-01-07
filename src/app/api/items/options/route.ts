import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/items/options - minimal item options for select boxes (with unit)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const assetParam = searchParams.get("asset");
    const siteIdParam = searchParams.get("siteId");
    const where: any = {};
    if (assetParam === "true") where.asset = true;
    if (assetParam === "false") where.asset = false;
    const siteIdNum = siteIdParam ? Number(siteIdParam) : undefined;
    if (siteIdNum && !Number.isNaN(siteIdNum)) {
      where.siteItems = { some: { siteId: siteIdNum } };
    }

    const items = await prisma.item.findMany({
      where,
      select: {
        id: true,
        itemCode: true,
        item: true,
        unit: { select: { unitName: true } },
      },
      orderBy: [{ itemCode: "asc" }, { item: "asc" }],
    });
    return Success({ data: items });
  } catch (error) {
    console.error("Get item options error:", error);
    return ApiError("Failed to fetch item options");
  }
}
