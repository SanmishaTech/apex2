import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/reports/wage-sheet-details?period=MM-YYYY&siteId=123&mode=govt|company
// Returns detailed daily attendance breakdown for wage sheet PDF
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const siteId = searchParams.get("siteId");
    const mode = searchParams.get("mode") as "company" | "govt" | null;

    if (!period || !/^\d{2}-\d{4}$/.test(period)) {
      return NextResponse.json(
        { error: "Missing or invalid period (MM-YYYY)" },
        { status: 400 }
      );
    }

    const [mm, yyyy] = period.split("-").map((v) => parseInt(v, 10));
    const fromDate = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0));
    const toDate = new Date(Date.UTC(yyyy, mm, 0, 23, 59, 59));
    const daysInMonth = new Date(yyyy, mm, 0).getDate();

    // Fetch attendance records for the period
    const attendances = await prisma.attendance.findMany({
      where: {
        ...(siteId ? { siteId: Number(siteId) } : {}),
        date: { gte: fromDate, lte: toDate },
      },
      include: {
        site: true,
        manpower: {
          include: {
            manpowerSupplier: true,
            siteManpower: {
              select: {
                siteId: true,
                category: { select: { categoryName: true } },
                skillset: { select: { skillsetName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ siteId: "asc" }, { manpowerId: "asc" }, { date: "asc" }],
    });

    // Fetch payslip details based on mode (to get wage rates and deductions)
    const govt =
      mode === "govt" ? true : mode === "company" ? false : undefined;
    const paySlipDetails = await prisma.paySlipDetail.findMany({
      where: {
        ...(siteId ? { siteId: Number(siteId) } : {}),
        paySlip: { period, ...(govt !== undefined ? { govt } : {}) },
      },
      include: {
        site: true,
        paySlip: {
          include: {
            manpower: {
              include: {
                manpowerSupplier: true,
                siteManpower: {
                  select: {
                    siteId: true,
                    category: { select: { categoryName: true } },
                    skillset: { select: { skillsetName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ siteId: "asc" }, { paySlipId: "asc" }],
    });

    // Build daily attendance map: manpowerId -> siteId -> day -> status
    const dailyMap = new Map<
      number,
      Map<
        number,
        Map<number, { isPresent: boolean; isIdle: boolean; ot: number }>
      >
    >();

    for (const att of attendances) {
      const day = new Date(att.date).getUTCDate();
      if (!dailyMap.has(att.manpowerId)) {
        dailyMap.set(att.manpowerId, new Map());
      }
      const siteMap = dailyMap.get(att.manpowerId)!;
      if (!siteMap.has(att.siteId)) {
        siteMap.set(att.siteId, new Map());
      }
      // Treat idle as present as per current business rule
      const effectivePresent = !!att.isPresent || !!att.isIdle;
      siteMap.get(att.siteId)!.set(day, {
        isPresent: effectivePresent,
        isIdle: att.isIdle,
        ot: Number(att.ot || 0),
      });
    }

    // Build result grouped by site
    const siteGroups = new Map<number, any>();

    for (const detail of paySlipDetails) {
      const siteId = detail.siteId;
      const manpowerId = detail.paySlip.manpowerId;
      const manpower = detail.paySlip.manpower;

      const siteManpowerForThisSite = (manpower as any)?.siteManpower?.siteId === siteId
        ? (manpower as any).siteManpower
        : null;

      if (!siteGroups.has(siteId)) {
        siteGroups.set(siteId, {
          siteId,
          siteName: detail.site?.site || "",
          workers: [],
        });
      }

      const siteGroup = siteGroups.get(siteId)!;

      // Get daily attendance for this worker at this site
      const dailyAttendance: string[] = [];
      let totalPresent = 0;
      let totalOT = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = dailyMap.get(manpowerId)?.get(siteId)?.get(day);
        if (dayData) {
          if (dayData.isPresent) {
            let status = dayData.isIdle ? "I" : "P";
            // Idle also counts as present
            totalPresent++;
            // Count OT for both present and idle days
            totalOT += dayData.ot;
            // Add OT hours if present (for both P and I)
            if (dayData.ot > 0) {
              status += `\n${dayData.ot}`;
            }
            dailyAttendance.push(status);
          } else {
            dailyAttendance.push("A");
          }
        } else {
          dailyAttendance.push("");
        }
      }

      siteGroup.workers.push({
        manpowerId,
        manpowerName: `${manpower?.firstName || ""} ${
          manpower?.lastName || ""
        }`.trim(),
        designation: siteManpowerForThisSite?.category?.categoryName || "",
        unaNo: manpower?.unaNo || "",
        esicNo: manpower?.esicNo || "",
        skillSet: siteManpowerForThisSite?.skillset?.skillsetName || "",
        supplierId: manpower?.supplierId || 0,
        supplierName: manpower?.manpowerSupplier?.supplierName || "",
        dailyAttendance,
        totalDays: totalPresent,
        workingDays: Number(detail.workingDays || 0),
        totalOT: Number(detail.ot || 0),
        idleDays: Number(detail.idle || 0),
        idleOT: 0,
        wageRate: Number(detail.wages || 0),
        grossWage: Number(detail.grossWages || 0),
        actualWages: Number(detail.total || 0),
        idleWages: Number(detail.wages || 0) * Number(detail.idle || 0),
        totalWages:
          Number(detail.total || 0) +
          Number(detail.wages || 0) * Number(detail.idle || 0),
        hra: Number(detail.hra || 0),
        pf: Number(detail.pf || 0),
        esic: Number(detail.esic || 0),
        pt: Number(detail.pt || 0),
        lwf: Number(detail.mlwf || 0),
        totalDeduction:
          Number(detail.hra || 0) +
          Number(detail.pf || 0) +
          Number(detail.esic || 0) +
          Number(detail.pt || 0) +
          Number(detail.mlwf || 0),
        payable: Number(detail.total || 0),
      });
    }

    const result = {
      period,
      daysInMonth,
      data: Array.from(siteGroups.values()),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Wage sheet details error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch wage sheet details" },
      { status: 500 }
    );
  }
}
