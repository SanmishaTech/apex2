import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// GET /api/stocks/overall
// Returns paginated list of overall stock per site-item
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(1, Math.min(100, parseInt(searchParams.get("perPage") || "10", 10)));
    const search = (searchParams.get("search") || "").trim();
    const siteIdParam = searchParams.get("siteId");
    const itemIdParam = searchParams.get("itemId");
    const sort = (searchParams.get("sort") || "site").toString();
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const siteId = siteIdParam ? Number(siteIdParam) : undefined;
    const itemId = itemIdParam ? Number(itemIdParam) : undefined;

    const where: any = {};
    // Restrict to assigned sites for non-admin users
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      if (Number.isFinite(siteId as number)) {
        // intersect requested site with assigned sites
        const sid = siteId as number;
        where.siteId = { in: assignedSiteIds.includes(sid) ? [sid] : [-1] };
      } else {
        where.siteId = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
      }
    } else {
      if (Number.isFinite(siteId as number)) where.siteId = siteId;
    }
    if (Number.isFinite(itemId as number)) where.itemId = itemId;

    if (search) {
      where.OR = [
        { site: { site: { contains: search, mode: "insensitive" } } },
        { item: { item: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Sorting mapping
    const orderBy: any[] = [];
    if (sort === "site") orderBy.push({ site: { site: order } });
    else if (sort === "item") orderBy.push({ item: { item: order } });
    else if (sort === "unit") orderBy.push({ item: { unit: { unitName: order } } });
    else if (sort === "openingQty") orderBy.push({ openingStock: order });
    else if (sort === "closingQty") orderBy.push({ closingStock: order });
    else orderBy.push({ site: { site: "asc" } }, { item: { item: "asc" } });

    const total = await prisma.siteItem.count({ where });

    const rows = await prisma.siteItem.findMany({
      where,
      select: {
        id: true,
        siteId: true,
        itemId: true,
        openingStock: true,
        closingStock: true,
        site: { select: { id: true, site: true } },
        item: { select: { id: true, item: true, unit: { select: { unitName: true } } } },
      },
      orderBy: orderBy.length ? orderBy : undefined,
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const data = rows.map((r) => ({
      id: r.id,
      siteId: r.siteId,
      site: r.site?.site || "-",
      itemId: r.itemId,
      item: r.item?.item || "",
      unit: r.item?.unit?.unitName || null,
      openingQty: Number(r.openingStock || 0),
      closingQty: Number(r.closingStock || 0),
    }));

    return Success({
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    });
  } catch (error) {
    console.error("Get overall stock error:", error);
    return ApiError("Failed to fetch overall stock");
  }
}
