import { NextRequest, NextResponse } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/site-budgets/[id]/download-pdf - Download PDF report for site budget
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  return NextResponse.json(
    { error: "Site budget PDF download is temporarily disabled" },
    { status: 501 }
  );
}
