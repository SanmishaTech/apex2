import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// GET /api/stock/sites?search=&page=1&perPage=10&sort=site|itemCount&order=asc|desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() ?? "";
    const sort = (searchParams.get("sort") || "site").toString();
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
      | "asc"
      | "desc";

    const where: any = search
      ? {
          OR: [
            { site: { contains: search } },
            { siteCode: { contains: search } },
          ],
        }
      : {};

    // Non-admin users: limit to assigned sites
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      (where as any).id = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
    }

    const total = await prisma.site.count({ where });

    // Build orderBy. For itemCount, order by relation count
    const orderBy: any =
      sort === "itemCount" ? { siteItems: { _count: order } } : { site: order };

    const sites = await prisma.site.findMany({
      where,
      select: {
        id: true,
        site: true,
        siteCode: true,
        companyId: true,
        _count: { select: { siteItems: true } },
      },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Count only SiteItems with closingStock > 0 for these sites
    const siteIds = sites.map((s) => s.id);
    const counts = siteIds.length
      ? await prisma.siteItem.groupBy({
          by: ["siteId"],
          where: { siteId: { in: siteIds }, closingStock: { gt: 0 } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map<number, number>();
    for (const c of counts as Array<{
      siteId: number;
      _count: { _all: number };
    }>) {
      countMap.set(c.siteId, c._count._all);
    }

    const data = sites.map((s) => ({
      id: s.id,
      site: s.site,
      siteCode: s.siteCode,
      companyId: s.companyId,
      itemCount: countMap.get(s.id) || 0,
    }));
    const meta = {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
    return Success({ data, meta });
  } catch (error) {
    console.error("Stock sites list error:", error);
    return ApiError("Failed to fetch stock sites");
  }
}
