import { prisma } from "@/lib/prisma";
import type { Decimal } from "@prisma/client/runtime/library";

export type PayrollMode = "company";

export interface GeneratePayrollParams {
  period: string; // "MM-YYYY"
  paySlipDate: string | Date;
  modes?: PayrollMode[]; // default: ["company"]
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
  const nRaw = typeof num === "number" ? num : Number(num);
  if (!Number.isFinite(nRaw)) return "Zero";

  const abs = Math.abs(nRaw);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const twoDigits = (x: number) => {
    if (x === 0) return "";
    if (x < 20) return ones[x];
    const t = Math.floor(x / 10);
    const r = x % 10;
    return tens[t] + (r ? " " + ones[r] : "");
  };

  const threeDigits = (x: number) => {
    if (x === 0) return "";
    const h = Math.floor(x / 100);
    const r = x % 100;
    const head = h ? `${ones[h]} hundred` : "";
    const tail = r ? twoDigits(r) : "";
    return [head, tail].filter(Boolean).join(" ");
  };

  const indianIntToWords = (x: number) => {
    if (x === 0) return "zero";
    let n = x;
    const parts: string[] = [];

    const crore = Math.floor(n / 10000000);
    if (crore) {
      parts.push(`${indianIntToWords(crore)} crore`);
      n = n % 10000000;
    }

    const lakh = Math.floor(n / 100000);
    if (lakh) {
      parts.push(`${indianIntToWords(lakh)} lakh`);
      n = n % 100000;
    }

    const thousand = Math.floor(n / 1000);
    if (thousand) {
      parts.push(`${indianIntToWords(thousand)} thousand`);
      n = n % 1000;
    }

    const hundreds = n;
    if (hundreds) {
      parts.push(threeDigits(hundreds));
    }

    return parts.join(" ").trim();
  };

  const titleCase = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  let words = titleCase(indianIntToWords(rupees));
  if (paise > 0) {
    const p = titleCase(indianIntToWords(paise));
    words = `${words} And ${p} Paise`;
  }
  if (nRaw < 0) {
    words = `Minus ${words}`;
  }
  return words;
}

export async function generatePayroll(params: GeneratePayrollParams) {
  const modes: PayrollMode[] = params.modes && params.modes.length ? params.modes : ["company"];
  const { from, to, month } = parsePeriod(params.period);
  const paySlipDate = new Date(params.paySlipDate);

  // Load or create default config
  const cfg = await prisma.payrollConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      hoursPerDay: 8,
      pfPercentage: 12,
      esicThreshold: 21000,
      esicPercentage: 0.75,
      ptThreshold1: 7500,
      ptAmount1: 175,
      ptThreshold2: 10000,
      ptAmount2: 200,
      febPtAmount: 300,
      ptThresholdWomen: 25000,
      ptAmountWomen: 200,
      mlwfAmount: 25,
      mlwfMonths: "06,12",
    },
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
    const effectivePresent = Boolean(a.isPresent) || Boolean(a.isIdle);
    if (effectivePresent) {
      cur.presentDays += 1;
      // Sum OT for both present and idle days (idle is treated as present in reports)
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
    },
    select: {
      manpowerId: true,
      siteId: true,
      wage: true,
      pf: true,
      esic: true,
      pt: true,
      mlwf: true,
      foodCharges: true,
      foodCharges2: true,
    },
  });
  const siteManpowerMap = new Map(
    siteManpowerList.map((s) => [`${s.manpowerId}:${s.siteId}`, s] as const)
  );

  // Also fetch ManpowerTransferItem for transferred manpower (preserves wage data at transfer time)
  const transferItems = await prisma.manpowerTransferItem.findMany({
    where: {
      manpowerId: { in: manpowerIds.length ? manpowerIds : [0] },
      // Transfer FROM the site we're generating payroll for
      manpowerTransfer: { fromSiteId: { in: siteIds.length ? siteIds : [0] } },
    },
    select: {
      manpowerId: true,
      wage: true,
      pf: true,
      esic: true,
      pt: true,
      mlwf: true,
      manpowerTransfer: { select: { fromSiteId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Build a map from transfer items as fallback for transferred manpower
  // Key format: "manpowerId:fromSiteId"
  const transferItemMap = new Map<string, typeof transferItems[0]>();
  for (const item of transferItems) {
    const key = `${item.manpowerId}:${item.manpowerTransfer.fromSiteId}`;
    // Only use the most recent transfer per manpower+site
    if (!transferItemMap.has(key)) {
      transferItemMap.set(key, item);
    }
  }

  // Helper to get assignment data - tries current siteManpower first, then transfer item
  type SiteManpowerData = {
    wage: number | Decimal | null;
    pf: boolean;
    esic: boolean;
    pt: boolean;
    mlwf: boolean;
    foodCharges: number | Decimal | null;
    foodCharges2: number | Decimal | null;
  };

  const getSiteManpowerData = (manpowerId: number, siteId: number): SiteManpowerData | null => {
    const key = `${manpowerId}:${siteId}` as AttendanceAggKey;
    // Try current assignment first
    const current = siteManpowerMap.get(key);
    if (current) return current;
    // Fall back to transfer item (which has preserved wage data)
    const transfer = transferItemMap.get(key);
    if (transfer) {
      // Return in same shape as siteManpower
      return {
        wage: transfer.wage,
        pf: transfer.pf,
        esic: Boolean(transfer.esic),
        pt: Boolean(transfer.pt),
        mlwf: Boolean(transfer.mlwf),
        foodCharges: 0,
        foodCharges2: 0,
      };
    }
    // Note: SiteManpowerLog is no longer used in business logic (kept for audit only)
    return null;
  };

  const results: { mode: PayrollMode; created: number; warnings: string[] }[] = [];

  // Helper to delete existing slips for period+mode
  async function clearExisting(mode: PayrollMode) {
    await prisma.paySlipDetail.deleteMany({ where: { paySlip: { period: params.period } } });
    await prisma.paySlip.deleteMany({ where: { period: params.period } });
  }

    // Company mode
    if (modes.includes("company")) {
      const warnings: string[] = [];
      await clearExisting("company");

      const paySlipsToCreate: any[] = [];
      const monthStr = String(month).padStart(2, "0");
      const isMlwfMonth = cfg.mlwfMonths.split(",").includes(monthStr);

      for (const { manpowerId, details } of byManpower.values()) {
        const mp = manpowerMap.get(manpowerId);
        if (!mp) continue;

        // Calculate total monthly gross to check ESIC threshold
        let totalGrossMonthly = 0;
        const siteDataList = (details as any[]).map((d) => {
          const smp = getSiteManpowerData(manpowerId, d.siteId);
          if (!smp) return { ...d, smp: null, wage: 0, gross: 0 };
          const wage = smp.wage ? Number(smp.wage) : 0;
          const totalDays = d.presentDays + Number(d.otDays);
          const gross = toFixed2(totalDays * wage);
          totalGrossMonthly += gross;
          return { ...d, smp, wage, gross };
        });

        let net = 0;
        const dets: any[] = [];
        let mlwfDeducted = false;
        let ptDeducted = false;

        for (const data of siteDataList) {
          if (!data.smp) continue;
          const { smp, gross, wage } = data;

          if (!wage) {
            warnings.push(
              `Manpower ${manpowerId} has no wage; computed as 0 for site ${data.siteId}`
            );
          }

          // 1) PF: Calculate if flag is true (no other condition)
          const pf = smp.pf ? toFixed2(gross * (Number(cfg.pfPercentage) / 100)) : 0;

          // 2) ESIC: Calculate if flag is true AND total monthly gross <= threshold
          const esic =
            smp.esic && totalGrossMonthly <= Number(cfg.esicThreshold)
              ? toFixed2(gross * (Number(cfg.esicPercentage) / 100))
              : 0;

          // 3) MLWF: Calculate if flag is true AND is a sanctioned month (deduct once per month)
          let mlwf = 0;
          if (smp.mlwf && isMlwfMonth && !mlwfDeducted) {
            mlwf = Number(cfg.mlwfAmount);
            mlwfDeducted = true;
          }

          // 4) PT: Calculate if flag is true AND not already deducted
          let pt = 0;
          if (smp.pt) {
            if (!mp.gender || !mp.gender.trim()) {
              throw new Error("Can not calculate pt if gender not specified");
            }
            if (!ptDeducted) {
              const isFemale = mp.gender?.toLowerCase() === "female" || mp.gender?.toLowerCase() === "f";
              if (isFemale) {
                if (totalGrossMonthly > Number(cfg.ptThresholdWomen)) {
                  pt = month === 2 ? Number(cfg.febPtAmount) : Number(cfg.ptAmountWomen);
                }
              } else {
                if (totalGrossMonthly > Number(cfg.ptThreshold1) && totalGrossMonthly <= Number(cfg.ptThreshold2)) {
                  pt = Number(cfg.ptAmount1);
                } else if (totalGrossMonthly > Number(cfg.ptThreshold2)) {
                  pt = month === 2 ? Number(cfg.febPtAmount) : Number(cfg.ptAmount2);
                }
              }
              if (pt > 0) ptDeducted = true;
            }
          }

          const foodCharge = Number(smp.foodCharges || 0) + Number(smp.foodCharges2 || 0);
          const total = toFixed2(gross - pf - esic - pt - mlwf - foodCharge);
          net += total;

          dets.push({
            siteId: data.siteId,
            workingDays: toFixed2(data.presentDays),
            ot: toFixed2(Number(data.otDays)),
            idle: toFixed2(data.idleDays),
            wages: toFixed2(wage),
            grossWages: toFixed2(gross),
            pf,
            esic,
            pt,
            mlwf,
            total: toFixed2(total),
            amountInWords: amountInWords(total),
          });
        }
      if (dets.length === 0) continue;
      paySlipsToCreate.push({
        manpowerId,
        period: params.period,
        paySlipDate,
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

  return { period: params.period, results };
}
