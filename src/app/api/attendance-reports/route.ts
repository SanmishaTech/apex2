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
    const month = searchParams.get("month"); // Format: YYYY-MM
    const category = searchParams.get("category") || undefined;
    const skillSet = searchParams.get("skillSet") || undefined;

    // Validate required parameters
    if (!siteIdsParam || !month) {
      return BadRequest("Site IDs and month are required");
    }

    // Parse site IDs
    const siteIds = siteIdsParam.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
    
    if (siteIds.length === 0) {
      return BadRequest("At least one valid site ID is required");
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      return BadRequest("Invalid month format. Use YYYY-MM");
    }

    // Calculate date range for the month
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999); // Last day of month
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Step 1: Fetch all attendance records for the date range and sites
    // This includes transferred manpower who have attendance but are no longer assigned
    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        siteId: { in: siteIds },
      },
      select: {
        date: true,
        isPresent: true,
        isIdle: true,
        ot: true,
        siteId: true,
        manpowerId: true,
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
                site: { select: { id: true, site: true, shortName: true } },
                category: { select: { id: true, categoryName: true } },
                skillset: { select: { id: true, skillsetName: true } },
              },
            },
          },
        },
        site: { select: { id: true, site: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Step 2: Also fetch currently assigned manpower for these sites
    const assignedManpowerWhere: any = {
      isAssigned: true,
      siteManpower: { siteId: { in: siteIds } },
    };
    if (category) {
      assignedManpowerWhere.siteManpower = {
        ...(assignedManpowerWhere.siteManpower || {}),
        category: { categoryName: category },
      };
    }
    if (skillSet) {
      assignedManpowerWhere.siteManpower = {
        ...(assignedManpowerWhere.siteManpower || {}),
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
            site: { select: { id: true, site: true, shortName: true } },
            category: { select: { id: true, categoryName: true } },
            skillset: { select: { id: true, skillsetName: true } },
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

    // Step 5: Transform data into report format
    const reportData: any[] = [];

    manpowerMap.forEach((mp) => {
      const mpAttendances = attendanceByManpower.get(mp.id) || [];

      // Apply category/skill filters on final data
      const currentSiteManpower = mp.siteManpower?.[0];
      if (category && currentSiteManpower?.category?.categoryName !== category && mpAttendances.length === 0) {
        return; // Skip if no attendance and category doesn't match
      }
      if (skillSet && currentSiteManpower?.skillset?.skillsetName !== skillSet && mpAttendances.length === 0) {
        return; // Skip if no attendance and skill doesn't match
      }

      // Skip if no attendance records
      if (mpAttendances.length === 0) return;

      // Create attendance map for this manpower
      const attendanceMap = new Map(
        mpAttendances.map((att: any) => [
          att.date.toISOString().split('T')[0],
          att,
        ])
      );

      // Generate daily attendance
      const dailyAttendance: { date: string; isPresent: boolean; isIdle: boolean; ot: number }[] = [];
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalOT = 0;
      let totalIdle = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const attendance = attendanceMap.get(dateStr);

        if (attendance) {
          const isPresent = attendance.isPresent;
          const isIdle = attendance.isIdle;
          const ot = attendance.ot ? Number(attendance.ot) : 0;

          dailyAttendance.push({ date: dateStr, isPresent, isIdle, ot });

          if (isPresent) {
            totalPresent++;
            totalOT += ot;
            if (isIdle) totalIdle++;
          } else {
            totalAbsent++;
          }
        }
      }

      // Determine site info
      const siteInfo = currentSiteManpower?.site || mpAttendances[0]?.site;
      const siteId = siteInfo?.id || mpAttendances[0]?.siteId;
      const siteName = siteInfo?.site || "Unknown Site";

      reportData.push({
        manpowerId: mp.id,
        manpowerName: `${mp.firstName} ${mp.middleName || ''} ${mp.lastName}`.trim(),
        supplierId: mp.manpowerSupplier?.id ?? 0,
        supplierName: mp.manpowerSupplier?.supplierName ?? "Unknown",
        category: currentSiteManpower?.category?.categoryName ?? null,
        skillSet: currentSiteManpower?.skillset?.skillsetName ?? null,
        siteId,
        siteName,
        dailyAttendance,
        totalPresent,
        totalAbsent,
        totalOT,
        totalIdle,
      });
    });

    // Group data by site
    const siteGroups = new Map();
    
    reportData.forEach((record) => {
      if (!siteGroups.has(record.siteId)) {
        siteGroups.set(record.siteId, {
          siteId: record.siteId,
          siteName: record.siteName,
          manpowerRecords: [],
          siteTotals: {
            totalManpower: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalOT: 0,
            totalIdle: 0,
          },
        });
      }
      
      const siteGroup = siteGroups.get(record.siteId);
      siteGroup.manpowerRecords.push(record);
      siteGroup.siteTotals.totalManpower++;
      siteGroup.siteTotals.totalPresent += record.totalPresent;
      siteGroup.siteTotals.totalAbsent += record.totalAbsent;
      siteGroup.siteTotals.totalOT += record.totalOT;
      siteGroup.siteTotals.totalIdle += record.totalIdle;
    });

    const groupedData = Array.from(siteGroups.values());

    // Calculate grand totals
    const grandTotals = {
      totalManpower: reportData.length,
      totalPresent: reportData.reduce((sum, r) => sum + r.totalPresent, 0),
      totalAbsent: reportData.reduce((sum, r) => sum + r.totalAbsent, 0),
      totalOT: reportData.reduce((sum, r) => sum + r.totalOT, 0),
      totalIdle: reportData.reduce((sum, r) => sum + r.totalIdle, 0),
    };

    return Success({
      data: groupedData,
      filters: {
        siteIds,
        month,
        category,
        skillSet,
      },
      totalRecords: reportData.length,
      grandTotals,
    });
  } catch (error) {
    console.error("Get attendance report error:", error);
    return Error("Failed to fetch attendance report");
  }
}
