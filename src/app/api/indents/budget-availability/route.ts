import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const siteIdStr = searchParams.get("siteId");
    const excludeIndentIdStr = searchParams.get("excludeIndentId");

    if (!siteIdStr) {
      return BadRequest("siteId is required");
    }

    const siteId = parseInt(siteIdStr, 10);
    const excludeIndentId = excludeIndentIdStr ? parseInt(excludeIndentIdStr, 10) : undefined;

    if (isNaN(siteId)) {
      return BadRequest("Invalid siteId");
    }

    const budgetItems = await prisma.overallSiteBudgetItem.groupBy({
      by: ["itemId"],
      _sum: {
        budgetQty: true,
      },
      where: {
        overallSiteBudgetDetail: {
          overallSiteBudget: {
            siteId: siteId,
          },
        },
      },
    });

    const budgetMap = new Map<number, number>();
    for (const item of budgetItems) {
      if (item._sum.budgetQty !== null) {
        budgetMap.set(item.itemId, Number(item._sum.budgetQty));
      }
    }

    // 2. Fetch all indents for the site, grouped by itemId
    const indentFilter: any = {
      indent: { siteId: siteId },
    };
    if (excludeIndentId && !isNaN(excludeIndentId)) {
      indentFilter.indentId = { not: excludeIndentId };
    }

    const usedIndents = await prisma.indentItem.groupBy({
      by: ["itemId"],
      _sum: {
        indentQty: true,
      },
      where: indentFilter,
    });

    const usedMap = new Map<number, number>();
    for (const used of usedIndents) {
      usedMap.set(used.itemId, Number(used._sum.indentQty || 0));
    }

    // 3. Construct response
    const availability: Record<string, { total: number; remaining: number }> = {};
    for (const [itemId, total] of budgetMap.entries()) {
      const used = usedMap.get(itemId) || 0;
      availability[String(itemId)] = {
        total,
        remaining: total - used,
      };
    }

    return Success(availability);
  } catch (error) {
    console.error("Get budget availability error:", error);
    return ApiError("Failed to fetch budget availability");
  }
}
