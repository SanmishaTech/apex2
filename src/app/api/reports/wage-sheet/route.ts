import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parsePeriod(period: string): { from: Date; to: Date } {
  const [mm, yyyy] = period.split("-").map((v) => parseInt(v, 10));
  if (!mm || !yyyy) throw new Error("Invalid period format. Expected MM-YYYY");
  const from = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(yyyy, mm, 0, 23, 59, 59));
  return { from, to };
}

// GET /api/reports/wage-sheet?period=MM-YYYY&siteId=123
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const siteId = searchParams.get("siteId");
  const siteIdsCsv = searchParams.get("siteIds");
  const categoryId = searchParams.get("categoryId");
  const pf = searchParams.get("pf");

  if (!period || !/^\d{2}-\d{4}$/.test(period)) {
    return NextResponse.json({ error: "Missing or invalid period (MM-YYYY)" }, { status: 400 });
  }

  const siteManpowerIs: Record<string, unknown> = {};
  if (categoryId) siteManpowerIs.categoryId = Number(categoryId);
  if (pf === "true" || pf === "false") siteManpowerIs.pf = pf === "true";

  const siteIds = (siteIdsCsv || "")
    .split(",")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  const resolvedSiteIds = siteIds.length
    ? siteIds
    : siteId
      ? [Number(siteId)]
      : [];

  const { from, to } = parsePeriod(period);

  // For company mode UI: compute OT from Attendance so OT is correct even if payslips were generated earlier
  // (Excel day-cells use attendance-based OT too).
  const otByManpowerSite = new Map<string, number>();
  {
    const attendances = await prisma.attendance.findMany({
      where: {
        ...(resolvedSiteIds.length ? { siteId: { in: resolvedSiteIds } } : {}),
        date: { gte: from, lte: to },
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
      select: {
        manpowerId: true,
        siteId: true,
        isPresent: true,
        isIdle: true,
        ot: true,
      },
    });

    for (const a of attendances) {
      const effectivePresent = Boolean(a.isPresent) || Boolean(a.isIdle);
      if (!effectivePresent) continue;
      const key = `${a.manpowerId}:${a.siteId}`;
      otByManpowerSite.set(key, (otByManpowerSite.get(key) || 0) + Number(a.ot || 0));
    }
  }

  const details = await prisma.paySlipDetail.findMany({
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
              siteManpower: { select: { siteId: true, ...({ foodCharges: true } as any), ...({ foodCharges2: true } as any) } },
            },
          },
        },
      },
    },
    orderBy: [{ siteId: "asc" }, { paySlipId: "asc" }],
  });

  const rows = details.map((d) => {
    const otFromAttendance = otByManpowerSite.get(`${(d as any).paySlip.manpowerId}:${d.siteId}`);
    const otValue = Number(otFromAttendance || 0);
    const smConfig = ((d as any).paySlip.manpower as any)?.siteManpower?.find((sm: any) => sm.siteId === d.siteId) 
      || ((d as any).paySlip.manpower as any)?.siteManpower?.[0];
    const foodCharges = Number(smConfig?.foodCharges ?? 0);
    const foodCharges2 = Number(smConfig?.foodCharges2 ?? 0);
    const rawTotal = Number(d.total ?? 0);
    return {
      siteId: d.siteId,
      siteName: (d as any).site?.site,
      manpowerId: (d as any).paySlip.manpowerId,
      manpowerName: `${(d as any).paySlip.manpower?.firstName ?? ""} ${(d as any).paySlip.manpower?.lastName ?? ""}`.trim(),
      supplier: (d as any).paySlip.manpower?.manpowerSupplier?.supplierName ?? null,
      accountNumber: (d as any).paySlip.manpower?.accountNumber ?? null,
      ifscCode: (d as any).paySlip.manpower?.ifscCode ?? null,
      bankName: (d as any).paySlip.manpower?.bank ?? null,
      workingDays: Number(d.workingDays ?? 0),
      ot: otValue,
      idle: Number(d.idle ?? 0),
      wages: Number(d.wages ?? 0),
      foodCharges,
      foodCharges2,
      grossWages: Number(d.grossWages ?? 0),
      pf: Number(d.pf ?? 0),
      esic: Number(d.esic ?? 0),
      pt: Number(d.pt ?? 0),
      mlwf: Number(d.mlwf ?? 0),
      total: rawTotal,
    };
  });

  // Summaries by site
  const bySite: Record<string, any> = {};
  for (const r of rows) {
    const k = String(r.siteId);
    const s = (bySite[k] ||= { siteId: r.siteId, siteName: r.siteName, workingDays: 0, ot: 0, idle: 0, grossWages: 0, foodCharges: 0, foodCharges2: 0, pf: 0, esic: 0, pt: 0, mlwf: 0, total: 0 });
    s.workingDays += r.workingDays;
    s.ot += r.ot;
    s.idle += r.idle;
    s.grossWages += r.grossWages;
    s.foodCharges += r.foodCharges;
    s.foodCharges2 += r.foodCharges2;
    s.pf += r.pf;
    s.esic += r.esic;
    s.pt += r.pt;
    s.mlwf += r.mlwf;
    s.total += r.total;
  }

  return NextResponse.json({ data: rows, summary: Object.values(bySite) });
}
