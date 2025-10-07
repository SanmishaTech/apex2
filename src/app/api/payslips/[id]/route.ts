import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = await params;
  const id = Number(paramId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const slip = await prisma.paySlip.findUnique({
    where: { id },
    include: { details: true, manpower: true },
  });
  if (!slip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: slip });
}
