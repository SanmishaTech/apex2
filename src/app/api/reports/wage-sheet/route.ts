import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/wage-sheet?period=MM-YYYY&mode=company|govt&siteId=123
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  const mode = searchParams.get("mode") as "company" | "govt" | null;
  const siteId = searchParams.get("siteId");

  if (!period || !/^\d{2}-\d{4}$/.test(period)) {
    return NextResponse.json({ error: "Missing or invalid period (MM-YYYY)" }, { status: 400 });
  }
  const govt = mode ? mode === "govt" : undefined;

  const details = await prisma.paySlipDetail.findMany({
    where: {
      ...(siteId ? { siteId: Number(siteId) } : {}),
      paySlip: { period, ...(govt !== undefined ? { govt } : {}) },
    },
    include: {
      site: true,
      paySlip: { include: { manpower: { include: { manpowerSupplier: true } } } },
    },
    orderBy: [{ siteId: "asc" }, { paySlipId: "asc" }],
  });

  const rows = details.map((d) => ({
    siteId: d.siteId,
    siteName: d.site?.site,
    manpowerId: d.paySlip.manpowerId,
    manpowerName: `${d.paySlip.manpower?.firstName ?? ""} ${d.paySlip.manpower?.lastName ?? ""}`.trim(),
    supplier: d.paySlip.manpower?.manpowerSupplier?.supplierName ?? null,
    workingDays: Number(d.workingDays ?? 0),
    ot: Number(d.ot ?? 0),
    idle: Number(d.idle ?? 0),
    wages: Number(d.wages ?? 0),
    grossWages: Number(d.grossWages ?? 0),
    hra: Number(d.hra ?? 0),
    pf: Number(d.pf ?? 0),
    esic: Number(d.esic ?? 0),
    pt: Number(d.pt ?? 0),
    mlwf: Number(d.mlwf ?? 0),
    total: Number(d.total ?? 0),
  }));

  // Summaries by site
  const bySite: Record<string, any> = {};
  for (const r of rows) {
    const k = String(r.siteId);
    const s = (bySite[k] ||= { siteId: r.siteId, siteName: r.siteName, workingDays: 0, ot: 0, idle: 0, grossWages: 0, hra: 0, pf: 0, esic: 0, pt: 0, mlwf: 0, total: 0 });
    s.workingDays += r.workingDays;
    s.ot += r.ot;
    s.idle += r.idle;
    s.grossWages += r.grossWages;
    s.hra += r.hra;
    s.pf += r.pf;
    s.esic += r.esic;
    s.pt += r.pt;
    s.mlwf += r.mlwf;
    s.total += r.total;
  }

  return NextResponse.json({ data: rows, summary: Object.values(bySite) });
}
