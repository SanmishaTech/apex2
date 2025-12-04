import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/daily-consumptions/[id]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid daily consumption ID");

    const dc = await prisma.dailyConsumption.findUnique({
      where: { id },
      select: {
        id: true,
        dailyConsumptionNo: true,
        dailyConsumptionDate: true,
        siteId: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        dailyConsumptionDetails: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            rate: true,
            amount: true,
            item: {
              select: {
                id: true,
                item: true,
                itemCode: true,
                unit: { select: { unitName: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!dc) return NotFound("Daily consumption not found");

    return Success(dc);
  } catch (error) {
    console.error("Get daily consumption error:", error);
    return ApiError("Failed to fetch daily consumption");
  }
}
