import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// GET /api/sites/options - minimal site options for select boxes
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const where: any = {};
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      where.id = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
    }

    const sites = await prisma.site.findMany({
      where,
      select: { id: true, site: true },
      orderBy: { site: "asc" },
      take: 1000,
    });
    return Success({ data: sites });
  } catch (error) {
    console.error("Get site options error:", error);
    return ApiError("Failed to fetch site options");
  }
}
