import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/outward-delivery-challans/options
// Returns minimal site and item data for select boxes
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const [sites, items] = await Promise.all([
      prisma.site.findMany({
        select: { id: true, site: true },
        orderBy: { site: "asc" },
        take: 1000,
      }),
      prisma.item.findMany({
        select: {
          id: true,
          itemCode: true,
          item: true,
          unit: { select: { unitName: true } },
        },
        orderBy: [{ itemCode: "asc" }, { item: "asc" }],
        take: 2000,
      }),
    ]);

    return Success({ sites, items });
  } catch (err) {
    console.error("Options fetch error:", err);
    return ApiError("Failed to fetch options");
  }
}
