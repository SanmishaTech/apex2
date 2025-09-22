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
    // Get total budget items for this site
    const totalItems = await prisma.siteBudget.count({
      where: { siteId: siteIdNum },
    });

    // Get budget value aggregations for this site
    const budgetAggregations = await prisma.siteBudget.aggregate({
      where: { siteId: siteIdNum },
      _sum: {
        budgetValue: true,
        orderedValue: true,
        budgetQty: true,
        orderedQty: true,
        budgetRate: true,
        avgRate: true,
      },
      _count: true,
    });

    // Get items with alerts count for this site
    const itemsWithAlerts = await prisma.siteBudget.count({
      where: {
        siteId: siteIdNum,
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
    
    const totalBudgetRate = Number(budgetAggregations._sum.budgetRate || 0);
    const totalAvgRate = Number(budgetAggregations._sum.avgRate || 0);
    const avgBudgetRate = totalItems > 0 ? totalBudgetRate / totalItems : 0;
    const avgOrderedRate = totalItems > 0 ? totalAvgRate / totalItems : 0;

    const summary = {
      totalBudgetValue,
      totalOrderedValue,
      budgetUtilization,
      totalItems,
      itemsWithAlerts,
      avgBudgetRate,
      avgOrderedRate,
    };

    return Success(summary);
  } catch (error: any) {
    console.error("Get site budget summary error:", error);
    return Success({
      totalBudgetValue: 0,
      totalOrderedValue: 0,
      budgetUtilization: 0,
      totalItems: 0,
      itemsWithAlerts: 0,
      avgBudgetRate: 0,
      avgOrderedRate: 0,
    });
  }
}
