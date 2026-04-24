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

    // Step 1: Fetch all attendance records for the date range and sites
    // This includes transferred manpower who have attendance but are no longer assigned
    const attendanceWhere: any = {
      date: { gte: startDate, lte: endDate },
      siteId: { in: siteIds },
    };

    const attendances = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: {
        manpowerId: true,
        siteId: true,
        isPresent: true,
        isIdle: true,
        ot: true,
        manpower: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            manpowerSupplier: { select: { id: true, supplierName: true } },
            siteManpower: {
              select: {
                siteId: true,
                site: { select: { id: true, site: true } },
                category: { select: { categoryName: true } },
                skillset: { select: { skillsetName: true } },
              },
            },
          },
        },
        site: {
          select: { id: true, site: true },
        },
      },
    });

    // Step 2: Also fetch currently assigned manpower for these sites (for those with zero attendance but still assigned)
    const assignedManpowerWhere: any = {
      isAssigned: true,
      siteManpower: {
        some: { siteId: { in: siteIds } },
      },
    };
    if (category) {
      assignedManpowerWhere.siteManpower.some = {
        ...(assignedManpowerWhere.siteManpower.some || {}),
        category: { categoryName: category },
      };
    }
    if (skillSet) {
      assignedManpowerWhere.siteManpower.some = {
        ...(assignedManpowerWhere.siteManpower.some || {}),
        skillset: { skillsetName: skillSet },
      };
    }

    const assignedManpower = await prisma.manpower.findMany({
      where: assignedManpowerWhere,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        manpowerSupplier: { select: { id: true, supplierName: true } },
        siteManpower: {
          select: {
            siteId: true,
            site: { select: { id: true, site: true } },
            category: { select: { categoryName: true } },
            skillset: { select: { skillsetName: true } },
          },
        },
      },
    });

    // Step 3: Combine and deduplicate manpower
    const manpowerMap = new Map<number, any>();

    // Add manpower from attendance records (includes transferred-out manpower)
    attendances.forEach((att) => {
      if (att.manpower && !manpowerMap.has(att.manpowerId)) {
        manpowerMap.set(att.manpowerId, att.manpower);
      }
    });

    // Add currently assigned manpower (if not already added)
    assignedManpower.forEach((mp) => {
      if (!manpowerMap.has(mp.id)) {
        manpowerMap.set(mp.id, mp);
      }
    });

    // Step 4: Group attendance records by manpowerId
    const attendanceByManpower = new Map<number, any[]>();
    attendances.forEach((att) => {
      if (!attendanceByManpower.has(att.manpowerId)) {
        attendanceByManpower.set(att.manpowerId, []);
      }
      attendanceByManpower.get(att.manpowerId)!.push(att);
    });

    // Step 5: Compute monthly totals per manpower
    const summaries: any[] = [];
    
    manpowerMap.forEach((mp) => {
      const mpAttendances = attendanceByManpower.get(mp.id) || [];
      
      // Apply category/skill filters on the final data if manpower has current assignment
      // For transferred manpower without current assignment, skip if category/skill filter is active
      const currentSiteManpower = mp.siteManpower?.[0];
      if (category && currentSiteManpower?.category?.categoryName !== category && mpAttendances.length === 0) {
        return; // Skip if no attendance and category doesn't match current assignment
      }
      if (skillSet && currentSiteManpower?.skillset?.skillsetName !== skillSet && mpAttendances.length === 0) {
        return; // Skip if no attendance and skill doesn't match current assignment
      }

      let totalPresent = 0;
      let totalAbsent = 0;
      let totalOT = 0;
      let totalIdle = 0;

      for (const att of mpAttendances) {
        if (att.isPresent) {
          totalPresent += 1;
          totalOT += att.ot ? Number(att.ot) : 0;
          if (att.isIdle) totalIdle += 1;
        } else {
          totalAbsent += 1;
        }
      }

      // Filter out manpower with zero attendance records (unless you want to show all assigned)
      if (mpAttendances.length === 0) return;

      // Determine site info - use current assignment if available, else use attendance site
      const siteInfo = currentSiteManpower?.site || mpAttendances[0]?.site;
      const siteId = siteInfo?.id || mpAttendances[0]?.siteId;
      const siteName = siteInfo?.site || "Unknown Site";

      summaries.push({
        manpowerId: mp.id,
        manpowerName: `${mp.firstName} ${mp.middleName || ""} ${mp.lastName}`.trim(),
        supplierId: mp.manpowerSupplier?.id ?? 0,
        supplierName: mp.manpowerSupplier?.supplierName ?? "Unknown",
        category: currentSiteManpower?.category?.categoryName ?? null,
        skillSet: currentSiteManpower?.skillset?.skillsetName ?? null,
        siteId,
        siteName,
        totalPresent,
        totalAbsent,
        totalOT,
        totalIdle,
      });
    });

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
