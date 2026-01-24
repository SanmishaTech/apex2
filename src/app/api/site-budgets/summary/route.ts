import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/site-budgets/summary - Get budget summary statistics
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    // Get total sites count
    const totalSites = await prisma.site.count();

    const totalBudgetItems = await (prisma as any).siteBudgetItem.count();

    const budgetAggregations = await (prisma as any).siteBudgetItem.aggregate({
      _sum: {
        budgetValue: true,
      },
    });

    const totalBudgetValue = Number(budgetAggregations._sum.budgetValue || 0);

    const summary = {
      totalSites,
      totalBudgetItems,
      totalBudgetValue,
    };

    return Success(summary);
  } catch (error: any) {
    console.error("Get budget summary error:", error);
    return Success({
      totalSites: 0,
      totalBudgetItems: 0,
      totalBudgetValue: 0,
    });
  }
}
