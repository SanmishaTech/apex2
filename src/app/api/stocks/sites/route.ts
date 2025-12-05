import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/stock/sites?search=&page=1&perPage=10&sort=site|itemCount&order=asc|desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() ?? "";
    const sort = (searchParams.get("sort") || "site").toString();
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    const where = search
      ? {
          OR: [
            { site: { contains: search } },
            { siteCode: { contains: search } },
          ],
        }
      : undefined;

    const total = await prisma.site.count({ where });

    // Build orderBy. For itemCount, order by relation count
    const orderBy: any = sort === "itemCount" ? { siteItems: { _count: order } } : { site: order };

    const sites = await prisma.site.findMany({
      where,
      select: { id: true, site: true, siteCode: true, companyId: true, _count: { select: { siteItems: true } } },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const data = sites.map((s) => ({ id: s.id, site: s.site, siteCode: s.siteCode, companyId: s.companyId, itemCount: (s as any)._count?.siteItems ?? 0 }));
    const meta = { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
    return Success({ data, meta });
  } catch (error) {
    console.error("Stock sites list error:", error);
    return ApiError("Failed to fetch stock sites");
  }
}
