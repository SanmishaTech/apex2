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

    // Build where clause for manpower
    const manpowerWhere: any = {
      isAssigned: true,
      currentSiteId: { in: siteIds },
    };

    if (category) {
      manpowerWhere.category = category;
    }

    if (skillSet) {
      manpowerWhere.skillSet = skillSet;
    }

    // Fetch assigned manpower for the selected sites with filters
    const manpowerList = await prisma.manpower.findMany({
      where: manpowerWhere,
      include: {
        manpowerSupplier: {
          select: {
            id: true,
            supplierName: true,
          },
        },
        currentSite: {
          select: {
            id: true,
            site: true,
            shortName: true,
          },
        },
        attendances: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            siteId: { in: siteIds },
          },
          select: {
            date: true,
            isPresent: true,
            isIdle: true,
            ot: true,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
      orderBy: [
        { currentSiteId: 'asc' },
        { manpowerSupplier: { supplierName: 'asc' } },
        { firstName: 'asc' },
      ],
    });

    // Calculate number of days in the month
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Transform data into report format and filter out manpower with no attendance records
    const reportData = manpowerList
      .map((manpower) => {
        // Create a map of attendance by date for quick lookup
        const attendanceMap = new Map(
          manpower.attendances.map((att) => [
            att.date.toISOString().split('T')[0],
            att,
          ])
        );

        // Generate daily attendance only for days with actual attendance records
        const dailyAttendance = [];
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalOT = 0;
        let totalIdle = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const attendance = attendanceMap.get(dateStr);

          // Only include days with actual attendance records
          if (attendance) {
            const isPresent = attendance.isPresent;
            const isIdle = attendance.isIdle;
            const ot = attendance.ot ? Number(attendance.ot) : 0;

            dailyAttendance.push({
              date: dateStr,
              isPresent,
              isIdle,
              ot,
            });

            if (isPresent) {
              totalPresent++;
              totalOT += ot;
              if (isIdle) {
                totalIdle++;
              }
            } else {
              totalAbsent++;
            }
          }
        }

        return {
          manpowerId: manpower.id,
          manpowerName: `${manpower.firstName} ${manpower.middleName || ''} ${manpower.lastName}`.trim(),
          supplierId: manpower.manpowerSupplier.id,
          supplierName: manpower.manpowerSupplier.supplierName,
          category: manpower.category,
          skillSet: manpower.skillSet,
          siteId: manpower.currentSite!.id,
          siteName: manpower.currentSite!.site,
          dailyAttendance,
          totalPresent,
          totalAbsent,
          totalOT,
          totalIdle,
        };
      })
      .filter((record) => record.dailyAttendance.length > 0); // Only include manpower with at least one attendance record

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
