import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePayroll } from "@/lib/payroll";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || undefined;
  const govt = searchParams.get("govt");

  const where: any = {};
  if (period) where.period = period;
  if (govt === "true") where.govt = true;
  if (govt === "false") where.govt = false;

  const slips = await prisma.paySlip.findMany({
    where,
    orderBy: [{ period: "desc" }, { manpowerId: "asc" }],
    include: { details: true, manpower: true },
  });

  return NextResponse.json({ data: slips });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const period: string = body.period;
    const paySlipDate: string = body.paySlipDate || new Date().toISOString();
    const modes: ("company" | "govt")[] | undefined = body.modes;

    if (!period || !/^\d{2}-\d{4}$/.test(period)) {
      return NextResponse.json({ error: "Invalid period. Expected MM-YYYY" }, { status: 400 });
    }

    const result = await generatePayroll({ period, paySlipDate, modes });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
