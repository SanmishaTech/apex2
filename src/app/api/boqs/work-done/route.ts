import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// GET /api/boqs/work-done
// Returns paginated list of BOQ items with ordered/remaining fields
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("perPage") || "10", 10))
    );
    const search = (searchParams.get("search") || "").trim();
    const siteIdParam = searchParams.get("siteId");
    const sort = (searchParams.get("sort") || "boqNo").toString();
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const siteId = siteIdParam ? Number(siteIdParam) : undefined;

    // Build where clause on BoqItem with relations
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
        const sid = siteId as number;
        where.boq = {
          siteId: { in: assignedSiteIds.includes(sid) ? [sid] : [-1] },
        };
      } else {
        where.boq = {
          siteId: { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] },
        };
      }
    } else if (Number.isFinite(siteId as number)) {
      where.boq = { siteId };
    }

    if (search) {
      where.OR = [
        { boq: { boqNo: { contains: search } } },
        { item: { contains: search } },
      ];
    }

    // Sorting mapping
    const orderBy: any[] = [];
    if (sort === "boqNo") orderBy.push({ boq: { boqNo: order } });
    else if (sort === "description") orderBy.push({ item: order });
    else if (sort === "qty") orderBy.push({ qty: order });
    else if (sort === "unit") orderBy.push({ unit: { unitName: order } });
    else if (sort === "orderedQty") orderBy.push({ orderedQty: order });
    else if (sort === "remainingQty") orderBy.push({ remainingQty: order });
    else if (sort === "rate") orderBy.push({ rate: order });
    else if (sort === "amount") orderBy.push({ amount: order });
    else if (sort === "orderedAmount") orderBy.push({ orderedValue: order });
    else if (sort === "remainingAmount")
      orderBy.push({ remainingValue: order });
    else if (sort === "site") orderBy.push({ boq: { site: { site: order } } });
    else orderBy.push({ boq: { boqNo: "asc" } });

    const total = await prisma.boqItem.count({ where });

    const rows = await prisma.boqItem.findMany({
      where,
      select: {
        id: true,
        boqId: true,
        item: true,
        qty: true,
        rate: true,
        amount: true,
        orderedQty: true,
        orderedValue: true,
        remainingQty: true,
        remainingValue: true,
        unit: { select: { unitName: true } },
        boq: {
          select: {
            id: true,
            boqNo: true,
            siteId: true,
            site: { select: { site: true } },
          },
        },
      },
      orderBy: orderBy.length ? orderBy : undefined,
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const data = rows.map((r) => ({
      id: r.id,
      boqId: r.boqId,
      boqNo: r.boq?.boqNo || "",
      siteId: r.boq?.siteId ?? null,
      site: r.boq?.site?.site || "-",
      itemId: r.id, // no separate item ID in BoqItem, keep line id
      description: r.item || "",
      qty: Number(r.qty || 0),
      unit: r.unit?.unitName || null,
      orderedQty: Number(r.orderedQty || 0),
      remainingQty: Number(r.remainingQty || 0),
      rate: Number(r.rate || 0),
      amount: Number(r.amount || 0),
      orderedAmount: Number(r.orderedValue || 0),
      remainingAmount: Number(r.remainingValue || 0),
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
    console.error("Get work-done list error:", error);
    return ApiError("Failed to fetch work-done list");
  }
}
