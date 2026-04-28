import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/reports/wage-sheet-details?period=MM-YYYY&siteId=123
// Returns detailed daily attendance breakdown for wage sheet PDF
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const siteId = searchParams.get("siteId");
    const siteIdsCsv = searchParams.get("siteIds");
    const categoryId = searchParams.get("categoryId");
    const pf = searchParams.get("pf");

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

    const siteIds = (siteIdsCsv || "")
      .split(",")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);

    const resolvedSiteIds = siteIds.length
      ? siteIds
      : siteId
        ? [Number(siteId)]
        : [];

    const siteManpowerIs: Record<string, unknown> = {};
    if (categoryId) siteManpowerIs.categoryId = Number(categoryId);
    if (pf === "true" || pf === "false") siteManpowerIs.pf = pf === "true";

    // Fetch attendance records for the period
    const attendances = await prisma.attendance.findMany({
      where: {
        ...(resolvedSiteIds.length ? { siteId: { in: resolvedSiteIds } } : {}),
        date: { gte: fromDate, lte: toDate },
        ...(Object.keys(siteManpowerIs).length
          ? {
              manpower: {
                siteManpower: {
                  some: siteManpowerIs,
                },
              },
            }
          : {}),
      },
      include: {
        site: true,
        manpower: {
          include: {
            manpowerSupplier: true,
            siteManpower: {
              select: {
                siteId: true,
                categoryId: true,
                pf: true,
                esic: true,
                ...({ foodCharges: true } as any),
                ...({ foodCharges2: true } as any),
                category: { select: { categoryName: true } },
                skillset: { select: { skillsetName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ siteId: "asc" }, { manpowerId: "asc" }, { date: "asc" }],
    });

    // Fetch payslip details (company mode only)
    const paySlipDetails = await prisma.paySlipDetail.findMany({
      where: {
        ...(resolvedSiteIds.length ? { siteId: { in: resolvedSiteIds } } : {}),
        paySlip: {
          period,
          ...(Object.keys(siteManpowerIs).length
            ? {
                manpower: {
                  siteManpower: {
                    some: siteManpowerIs,
                  },
                },
              }
            : {}),
        },
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
                    categoryId: true,
                    pf: true,
                    esic: true,
                    ...({ foodCharges: true } as any),
                    ...({ foodCharges2: true } as any),
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

    const payrollConfig = await prisma.payrollConfig.findFirst({ where: { id: 1 } });
    const pfPercentage = payrollConfig?.pfPercentage || 12;
    const esicPercentage = payrollConfig?.esicPercentage || 0.75;

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
      const manpowerId = (detail as any).paySlip.manpowerId;
      const manpower = (detail as any).paySlip.manpower;

      const smArray = (manpower as any)?.siteManpower || [];
      const siteManpowerForThisSite = smArray.find((sm: any) => sm.siteId === siteId) || smArray[0] || null;

      if (!siteManpowerForThisSite) continue;

      if (!siteGroups.has(siteId)) {
        siteGroups.set(siteId, {
          siteId,
          siteName: (detail as any).site?.site || "",
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
            if (dayData.ot !== 0) {
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

      const grossWage = Number(detail.grossWages || 0);
      const pt = Number(detail.pt || 0);
      const lwf = Number(detail.mlwf || 0);

      // Use saved PF/ESIC amounts from the payroll detail to ensure exact matching 
      // with DB and respecting thresholds (like ESIC > 21k rule)
      const pfAmount = Number(detail.pf || 0);
      const esicAmount = Number(detail.esic || 0);

      const foodCharges = Number(siteManpowerForThisSite?.foodCharges || 0);
      const foodCharges2 = Number(siteManpowerForThisSite?.foodCharges2 || 0);
      const totalDeduction = pfAmount + esicAmount + pt + lwf + foodCharges + foodCharges2;
      const payable = Math.max(0, grossWage - totalDeduction);

      siteGroup.workers.push({
        manpowerId,
        manpowerName: `${manpower?.firstName || ""} ${
          manpower?.lastName || ""
        }`.trim(),
        designation: siteManpowerForThisSite?.category?.categoryName || "",
        unaNo: manpower?.unaNo || "",
        esicNo: manpower?.esicNo || "",
        aadharNo: manpower?.aadharNo || "",
        panNo: manpower?.panNumber || "",
        skillSet: siteManpowerForThisSite?.skillset?.skillsetName || "",
        supplierId: manpower?.supplierId || 0,
        supplierName: manpower?.manpowerSupplier?.supplierName || "",
        accountNumber: manpower?.accountNumber || "",
        ifscCode: manpower?.ifscCode || "",
        bankName: manpower?.bank || "",
        dailyAttendance,
        totalDays: totalPresent,
        workingDays: Number(detail.workingDays || 0),
        totalOT: Number(detail.ot || 0),
        idleDays: Number(detail.idle || 0),
        idleOT: 0,
        wageRate: Number(detail.wages || 0),
        foodCharges,
        foodCharges2,
        grossWage,
        actualWages: Number(detail.total || 0),
        idleWages: 0,
        totalWages: Number(detail.total || 0),
        pf: pfAmount,
        esic: esicAmount,
        pt,
        lwf,
        totalDeduction,
        payable,
      });
    }

    const result = {
      period,
      daysInMonth,
      mode: "company",
      filters: {
        siteIds: resolvedSiteIds.length ? resolvedSiteIds : null,
        categoryId: categoryId || null,
        pf: pf || null,
      },
      config: {
        pfPercentage,
        esicPercentage
      },
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
