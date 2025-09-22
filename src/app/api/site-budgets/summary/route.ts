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

    // Get total budget items count
    const totalBudgetItems = await prisma.siteBudget.count();

    // Get budget value aggregations
    const budgetAggregations = await prisma.siteBudget.aggregate({
      _sum: {
        budgetValue: true,
        orderedValue: true,
      },
    });

    // Get sites with alerts count
    const sitesWithAlerts = await prisma.siteBudget.groupBy({
      by: ['siteId'],
      where: {
        OR: [
          { qty50Alert: true },
          { value50Alert: true },
          { qty75Alert: true },
          { value75Alert: true },
        ],
      },
    });

    const totalBudgetValue = Number(budgetAggregations._sum.budgetValue || 0);
    const totalOrderedValue = Number(budgetAggregations._sum.orderedValue || 0);
    const budgetUtilization = totalBudgetValue > 0 ? (totalOrderedValue / totalBudgetValue) * 100 : 0;

    const summary = {
      totalSites,
      totalBudgetItems,
      totalBudgetValue,
      totalOrderedValue,
      budgetUtilization,
      sitesWithAlerts: sitesWithAlerts.length,
    };

    return Success(summary);
  } catch (error: any) {
    console.error("Get budget summary error:", error);
    return Success({
      totalSites: 0,
      totalBudgetItems: 0,
      totalBudgetValue: 0,
      totalOrderedValue: 0,
      budgetUtilization: 0,
      sitesWithAlerts: 0,
    });
  }
}
