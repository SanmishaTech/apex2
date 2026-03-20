import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";

export async function GET(req: NextRequest) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_SITE_BUDGETS]);
  if (!auth.ok) return auth.response;

  // Retrieve distinct months and weeks actively defined within Budget bounds
  try {
    const monthsQuery = await prisma.siteBudget.findMany({
      distinct: ['month'],
      select: { month: true },
      where: { month: { not: "" } },
      orderBy: { month: 'asc' }
    });

    const weeksQuery = await prisma.siteBudget.findMany({
      distinct: ['week'],
      select: { week: true },
      where: { week: { not: "" } },
      orderBy: { week: 'asc' }
    });

    return NextResponse.json({
      months: monthsQuery.map(m => m.month),
      weeks: weeksQuery.map(w => w.week)
    });
  } catch(e) {
    return NextResponse.json({ months: [], weeks: [] });
  }
}
