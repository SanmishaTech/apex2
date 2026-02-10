import { prisma } from "@/lib/prisma";

export type PayrollMode = "company" | "govt";

export interface GeneratePayrollParams {
  period: string; // "MM-YYYY"
  paySlipDate: string | Date;
  modes?: PayrollMode[]; // default: ["company","govt"]
}

type AttendanceAggKey = `${number}:${number}`; // manpowerId:siteId

function parsePeriod(period: string): { from: Date; to: Date; month: number; year: number } {
  const [mm, yyyy] = period.split("-").map((v) => parseInt(v, 10));
  if (!mm || !yyyy) throw new Error("Invalid period format. Expected MM-YYYY");
  const from = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0));
  // last day of month: new Date(yyyy, mm, 0)
  const to = new Date(Date.UTC(yyyy, mm, 0, 23, 59, 59));
  return { from, to, month: mm, year: yyyy };
}

function toFixed2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function amountInWords(num: number): string {
  // Simple en words generator (non-Indian format). Good enough for now.
  // For full Indian numbering (Lakh/Crore), enhance later if needed.
  const a = ["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const b = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "zero";
  const numToWords = (x: number): string => {
    if (x < 20) return a[x];
    if (x < 100) return b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
    if (x < 1000) return a[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " + numToWords(x % 100) : "");
    if (x < 1000000) return numToWords(Math.floor(x / 1000)) + " thousand" + (x % 1000 ? " " + numToWords(x % 1000) : "");
    if (x < 1000000000) return numToWords(Math.floor(x / 1000000)) + " million" + (x % 1000000 ? " " + numToWords(x % 1000000) : "");
    return numToWords(Math.floor(x / 1000000000)) + " billion" + (x % 1000000000 ? " " + numToWords(x % 1000000000) : "");
  };
  return numToWords(n);
}

export async function generatePayroll(params: GeneratePayrollParams) {
  const modes: PayrollMode[] = params.modes && params.modes.length ? params.modes : ["company", "govt"];
  const { from, to, month } = parsePeriod(params.period);
  const paySlipDate = new Date(params.paySlipDate);

  // Load or create default config
  const cfg = await prisma.payrollConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {},
  });

  // Gather attendance within period
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: from, lte: to },
    },
    select: {
      manpowerId: true,
      siteId: true,
      isPresent: true,
      isIdle: true,
      ot: true,
    },
  });

  // Aggregate by manpowerId+siteId
  // Aggregate OT as DAYS (to mirror legacy). If you store hours, enter fractional days (e.g., 0.5 for half-day).
  const aggs = new Map<AttendanceAggKey, { manpowerId: number; siteId: number; presentDays: number; otDays: number; idleDays: number }>();
  for (const a of attendances) {
    const key = `${a.manpowerId}:${a.siteId}` as AttendanceAggKey;
    const cur = aggs.get(key) ?? { manpowerId: a.manpowerId, siteId: a.siteId, presentDays: 0, otDays: 0, idleDays: 0 };
    if (a.isPresent) {
      cur.presentDays += 1;
      // Sum OT only when present, same as legacy query SUM(IF(attendance, ot, 0))
      cur.otDays += Number(a.ot ?? 0);
    }
    if (a.isIdle) cur.idleDays += 1;
    aggs.set(key, cur);
  }

  // Group by manpower
  const byManpower = new Map<number, { manpowerId: number; details: typeof aggs extends Map<any, infer V> ? V[] : never }>();
  for (const { manpowerId, siteId, presentDays, otDays, idleDays } of aggs.values()) {
    const item = byManpower.get(manpowerId) ?? { manpowerId, details: [] as any };
    (item.details as any).push({ manpowerId, siteId, presentDays, otDays, idleDays });
    byManpower.set(manpowerId, item);
  }

  // Preload manpower records
  const manpowerIds = Array.from(byManpower.keys());
  const manpowerList = await prisma.manpower.findMany({
    where: { id: { in: manpowerIds.length ? manpowerIds : [0] } },
  });
  const manpowerMap = new Map(manpowerList.map((m) => [m.id, m]));

  // Preload site-specific assignment/payroll fields
  const siteIds = Array.from(new Set(Array.from(aggs.values()).map((a) => a.siteId)));
  const siteManpowerList = await prisma.siteManpower.findMany({
    where: {
      manpowerId: { in: manpowerIds.length ? manpowerIds : [0] },
      siteId: { in: siteIds.length ? siteIds : [0] },
      isPresent: true,
    },
    select: {
      manpowerId: true,
      siteId: true,
      wage: true,
      minWage: true,
      pf: true,
      esic: true,
      hra: true,
      pt: true,
      mlwf: true,
    },
  });
  const siteManpowerMap = new Map(
    siteManpowerList.map((s) => [`${s.manpowerId}:${s.siteId}`, s] as const)
  );

  const results: { mode: PayrollMode; created: number; warnings: string[] }[] = [];

  // Helper to delete existing slips for period+mode
  async function clearExisting(mode: PayrollMode) {
    await prisma.paySlipDetail.deleteMany({ where: { paySlip: { period: params.period, govt: mode === "govt" } } });
    await prisma.paySlip.deleteMany({ where: { period: params.period, govt: mode === "govt" } });
  }

  // Company mode
  if (modes.includes("company")) {
    const warnings: string[] = [];
    await clearExisting("company");

    const paySlipsToCreate: any[] = [];
    for (const { manpowerId, details } of byManpower.values()) {
      const mp = manpowerMap.get(manpowerId);
      if (!mp) continue;
      let net = 0;
      const dets: any[] = [];
      for (const d of details as any[]) {
        // Legacy parity: OT is treated as DAYS, not hours
        const totalDays = d.presentDays + Number(d.otDays);
        const smp = siteManpowerMap.get(`${manpowerId}:${d.siteId}`);
        if (!smp) continue;
        const wage = smp?.wage ? Number(smp.wage) : smp?.minWage ? Number(smp.minWage) : 0;
        if (!wage) warnings.push(`Manpower ${manpowerId} has no wage/minWage; computed as 0 for site ${d.siteId}`);
        const gross = toFixed2(totalDays * wage);
        const total = Math.round(gross);
        net += total;
        dets.push({
          siteId: d.siteId,
          workingDays: toFixed2(d.presentDays),
          ot: toFixed2(Number(d.otDays)),
          idle: toFixed2(d.idleDays),
          wages: toFixed2(wage),
          grossWages: toFixed2(gross),
          total: toFixed2(total),
          amountInWords: amountInWords(total),
        });
      }
      if (dets.length === 0) continue;
      paySlipsToCreate.push({
        manpowerId,
        period: params.period,
        paySlipDate,
        govt: false,
        netWages: toFixed2(net),
        amountInWords: amountInWords(net),
        details: dets,
      });
    }

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const data of paySlipsToCreate) {
        const { details, ...slipData } = data as any;
        const slip = await tx.paySlip.create({ data: slipData });
        if (Array.isArray(details) && details.length) {
          await tx.paySlipDetail.createMany({
            data: details.map((d: any) => ({ ...d, paySlipId: slip.id })),
            skipDuplicates: true,
          });
        }
        createdCount += 1;
      }
    });
    results.push({ mode: "company", created: createdCount, warnings });
  }

  // Govt mode
  if (modes.includes("govt")) {
    const warnings: string[] = [];
    await clearExisting("govt");

    const cap = Number(cfg.govtWorkingDayCap);
    const hraPct = Number(cfg.hraPercentage);
    const pfPct = Number(cfg.pfPercentage);
    const esicPct = Number(cfg.esicPercentage);
    const ptTh1 = Number(cfg.ptThreshold1);
    const ptAmt1 = Number(cfg.ptAmount1);
    const ptTh2 = Number(cfg.ptThreshold2);
    const ptAmt2 = Number(cfg.ptAmount2);
    const febPtAmt = Number(cfg.febPtAmount);
    const mlwfAmt = Number(cfg.mlwfAmount);
    const mlwfMonths = String(cfg.mlwfMonths || "02,06").split(",").map((s) => s.trim());

    const paySlipsToCreate: any[] = [];

    for (const { manpowerId, details } of byManpower.values()) {
      const mp = manpowerMap.get(manpowerId);
      if (!mp) continue;
      let net = 0;
      const dets: any[] = [];
      for (const d of details as any[]) {
        const workingDays = Math.min(d.presentDays, cap);
        const smp = siteManpowerMap.get(`${manpowerId}:${d.siteId}`);
        if (!smp) continue;
        const minWage = smp?.minWage ? Number(smp.minWage) : 0;
        if (!minWage) warnings.push(`Manpower ${manpowerId} has no minWage; computed as 0 for site ${d.siteId}`);
        const gross = toFixed2(workingDays * minWage);

        const applyHra = Boolean(smp?.hra);
        const hra = applyHra ? toFixed2((gross * hraPct) / 100) : 0;

        const applyPf = Boolean(smp?.pf);
        const pf = applyPf ? Math.round((gross * pfPct) / 100) : 0;

        const applyEsic = Boolean(smp?.esic);
        const esicBase = gross + hra;
        const esic = applyEsic ? toFixed2((esicBase * esicPct) / 100) : 0;

        const gwHra = gross + hra;
        let pt = 0;
        if (gwHra > ptTh1 && gwHra < ptTh2) pt = ptAmt1;
        if (gwHra > ptTh2) pt = ptAmt2;
        if (month === 2) pt = febPtAmt; // Feb override

        let mlwf = 0;
        if (Boolean(smp?.mlwf) && mlwfMonths.includes(`${month}`.padStart(2, "0"))) mlwf = mlwfAmt;

        const total = Math.round(gross + hra - pf - esic - pt - mlwf);
        net += total;
        dets.push({
          siteId: d.siteId,
          workingDays: toFixed2(workingDays),
          ot: toFixed2(Number(d.otDays)), // display OT like legacy, but not included in gross
          idle: toFixed2(d.idleDays),
          wages: toFixed2(minWage),
          grossWages: toFixed2(gross),
          hra: toFixed2(hra),
          pf: toFixed2(pf),
          esic: toFixed2(esic),
          pt: toFixed2(pt),
          mlwf: toFixed2(mlwf),
          total: toFixed2(total),
          amountInWords: amountInWords(total),
        });
      }
      if (dets.length === 0) continue;
      paySlipsToCreate.push({
        manpowerId,
        period: params.period,
        paySlipDate,
        govt: true,
        netWages: toFixed2(net),
        amountInWords: amountInWords(net),
        details: dets,
      });
    }

    let createdCountGovt = 0;
    await prisma.$transaction(async (tx) => {
      for (const data of paySlipsToCreate) {
        const { details, ...slipData } = data as any;
        const slip = await tx.paySlip.create({ data: slipData });
        if (Array.isArray(details) && details.length) {
          await tx.paySlipDetail.createMany({
            data: details.map((d: any) => ({ ...d, paySlipId: slip.id })),
            skipDuplicates: true,
          });
        }
        createdCountGovt += 1;
      }
    });
    results.push({ mode: "govt", created: createdCountGovt, warnings });
  }

  return { period: params.period, results };
}
