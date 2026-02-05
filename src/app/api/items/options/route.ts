import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// GET /api/items/options - minimal item options for select boxes (with unit)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const assetParam = searchParams.get("asset");
    const siteIdParam = searchParams.get("siteId");
    const assignedOnlyParam = searchParams.get("assignedOnly");
    const allParam = searchParams.get("all");
    const where: any = {};
    if (assetParam === "true") where.asset = true;
    if (assetParam === "false") where.asset = false;
    const siteIdNum = siteIdParam ? Number(siteIdParam) : undefined;
    const assignedOnly = assignedOnlyParam === "true";
    const all = allParam === "true";

    // Restrict items to assigned sites for non-admin users
    if (!all && (auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      if (siteIdNum && !Number.isNaN(siteIdNum)) {
        // Intersect selected site with assigned sites
        where.siteItems = {
          some: {
            siteId: {
              in: assignedSiteIds.includes(siteIdNum) ? [siteIdNum] : [-1],
            },
          },
        };
      } else {
        where.siteItems = {
          some: {
            siteId: { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] },
          },
        };
      }
    } else {
      // Admins: optional filter by siteId if provided
      if (siteIdNum && !Number.isNaN(siteIdNum)) {
        where.siteItems = { some: { siteId: siteIdNum } };
      } else if (assignedOnly) {
        // If explicitly requested, restrict to items that are assigned to at least one site
        where.siteItems = { some: {} };
      }
    }

    const items = await prisma.item.findMany({
      where,
      select: {
        id: true,
        itemCode: true,
        item: true,
        unit: { select: { unitName: true } },
      },
      orderBy: [{ itemCode: "asc" }, { item: "asc" }],
    });
    return Success({ data: items });
  } catch (error) {
    console.error("Get item options error:", error);
    return ApiError("Failed to fetch item options");
  }
}
