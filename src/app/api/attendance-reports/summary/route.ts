import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);

    // Get filter parameters
    const siteIdsParam = searchParams.get("siteIds");
    const month = searchParams.get("month"); // YYYY-MM
    const category = searchParams.get("category") || undefined;
    const skillSet = searchParams.get("skillSet") || undefined;

    if (!siteIdsParam || !month) {
      return BadRequest("Site IDs and month are required");
    }

    const siteIds = siteIdsParam
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));

    if (siteIds.length === 0) return BadRequest("At least one valid site ID is required");

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) return BadRequest("Invalid month format. Use YYYY-MM");

    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    // Build where clause for manpower
    const manpowerWhere: any = {
      isAssigned: true,
      currentSiteId: { in: siteIds },
    };
    if (category) manpowerWhere.category = category;
    if (skillSet) manpowerWhere.skillSet = skillSet;

    // Fetch manpower with attendances in the given month
    const manpowerList = await prisma.manpower.findMany({
      where: manpowerWhere,
      include: {
        manpowerSupplier: { select: { id: true, supplierName: true } },
        currentSite: { select: { id: true, site: true } },
        attendances: {
          where: {
            date: { gte: startDate, lte: endDate },
            siteId: { in: siteIds },
          },
          select: { date: true, isPresent: true, isIdle: true, ot: true },
          orderBy: { date: "asc" },
        },
      },
      orderBy: [
        { currentSiteId: "asc" },
        { manpowerSupplier: { supplierName: "asc" } },
        { firstName: "asc" },
      ],
    });

    // Compute monthly totals per manpower (only from recorded attendance rows)
    const summaries = manpowerList
      .map((mp) => {
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalOT = 0;
        let totalIdle = 0;

        for (const att of mp.attendances) {
          if (att.isPresent) {
            totalPresent += 1;
            totalOT += att.ot ? Number(att.ot) : 0;
            if (att.isIdle) totalIdle += 1;
          } else {
            totalAbsent += 1;
          }
        }

        // Filter out manpower with zero records
        if (mp.attendances.length === 0) return null;

        return {
          manpowerId: mp.id,
          manpowerName: `${mp.firstName} ${mp.middleName || ""} ${mp.lastName}`.trim(),
          supplierId: mp.manpowerSupplier.id,
          supplierName: mp.manpowerSupplier.supplierName,
          category: mp.category,
          skillSet: mp.skillSet,
          siteId: mp.currentSite!.id,
          siteName: mp.currentSite!.site,
          totalPresent,
          totalAbsent,
          totalOT,
          totalIdle,
        };
      })
      .filter(Boolean) as any[];

    // Group by site
    const siteMap = new Map<number, any>();
    for (const rec of summaries) {
      if (!siteMap.has(rec.siteId)) {
        siteMap.set(rec.siteId, {
          siteId: rec.siteId,
          siteName: rec.siteName,
          manpowerSummaries: [] as any[],
          siteTotals: {
            totalManpower: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalOT: 0,
            totalIdle: 0,
          },
        });
      }
      const sg = siteMap.get(rec.siteId);
      sg.manpowerSummaries.push(rec);
      sg.siteTotals.totalManpower += 1;
      sg.siteTotals.totalPresent += rec.totalPresent;
      sg.siteTotals.totalAbsent += rec.totalAbsent;
      sg.siteTotals.totalOT += rec.totalOT;
      sg.siteTotals.totalIdle += rec.totalIdle;
    }

    const groupedData = Array.from(siteMap.values());

    const grandTotals = {
      totalManpower: summaries.length,
      totalPresent: summaries.reduce((s, r) => s + r.totalPresent, 0),
      totalAbsent: summaries.reduce((s, r) => s + r.totalAbsent, 0),
      totalOT: summaries.reduce((s, r) => s + r.totalOT, 0),
      totalIdle: summaries.reduce((s, r) => s + r.totalIdle, 0),
    };

    return Success({
      data: groupedData,
      filters: { siteIds, month, category, skillSet },
      totalRecords: summaries.length,
      grandTotals,
    });
  } catch (err) {
    console.error("Get attendance summary error:", err);
    return Error("Failed to fetch manpower attendance summary");
  }
}
