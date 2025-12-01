import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/items/options - minimal item options for select boxes (with unit)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        itemCode: true,
        item: true,
        unit: { select: { unitName: true } },
      },
      orderBy: [{ itemCode: "asc" }, { item: "asc" }],
      take: 2000,
    });
    return Success({ data: items });
  } catch (error) {
    console.error("Get item options error:", error);
    return ApiError("Failed to fetch item options");
  }
}
