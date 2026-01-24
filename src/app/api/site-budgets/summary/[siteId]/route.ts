import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

type RouteParams = {
  params: Promise<{ siteId: string }>;
};

// GET /api/site-budgets/summary/[siteId] - Get budget summary for specific site
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { siteId } = await params;
  const siteIdNum = parseInt(siteId);

  if (isNaN(siteIdNum)) {
    return Error("Invalid site ID", 400);
  }

  try {
    const whereForSite = {
      siteBudgetDetail: {
        siteBudget: {
          siteId: siteIdNum,
        },
      },
    };

    const totalItems = await (prisma as any).siteBudgetItem.count({
      where: whereForSite,
    });

    const budgetAggregations = await (prisma as any).siteBudgetItem.aggregate({
      where: whereForSite,
      _sum: {
        budgetQty: true,
        budgetValue: true,
      },
    });

    const totalBudgetQty = Number(budgetAggregations._sum.budgetQty || 0);
    const totalBudgetValue = Number(budgetAggregations._sum.budgetValue || 0);
    const avgBudgetRate = totalBudgetQty > 0 ? totalBudgetValue / totalBudgetQty : 0;

    const summary = {
      totalItems,
      avgBudgetRate,
      totalBudgetValue,
    };

    return Success(summary);
  } catch (error: any) {
    console.error("Get site budget summary error:", error);
    return Success({
      totalBudgetValue: 0,
      totalItems: 0,
      avgBudgetRate: 0,
    });
  }
}
