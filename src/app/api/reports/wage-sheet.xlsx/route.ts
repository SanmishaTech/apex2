import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// GET /api/reports/wage-sheet.xlsx?period=MM-YYYY&mode=company|govt&siteId=123
export async function GET(req: NextRequest) {
  const apiUrl = new URL(req.url);
  const period = apiUrl.searchParams.get("period");
  const mode = apiUrl.searchParams.get("mode");
  const siteId = apiUrl.searchParams.get("siteId");

  if (!period || !/^\d{2}-\d{4}$/.test(period)) {
    return NextResponse.json({ error: "Missing or invalid period (MM-YYYY)" }, { status: 400 });
  }

  // Fetch JSON from sibling endpoint to keep logic single-sourced
  const base = `${apiUrl.origin}/api/reports/wage-sheet?period=${encodeURIComponent(period)}${mode ? `&mode=${encodeURIComponent(mode)}` : ""}${siteId ? `&siteId=${encodeURIComponent(siteId)}` : ""}`;
  const j = await fetch(base, { cache: "no-store" }).then((r) => r.json());
  if (!j?.data) {
    return NextResponse.json({ error: "No data" }, { status: 404 });
  }

  const rows = j.data as any[];

  // Build worksheet
  const header = [
    ["Period", period, "Mode", mode || "all"],
  ];
  const columns = [[
    "Site ID", "Site", "Manpower", "Supplier",
    "Working Days", "OT", "Idle", "Wage", "Gross",
    "HRA", "PF", "ESIC", "PT", "MLWF", "Total",
  ]];
  const dataRows = rows.map((r) => [
    r.siteId, r.siteName || "",
    r.manpowerName || "", r.supplier || "",
    r.workingDays, r.ot, r.idle, r.wages, r.grossWages,
    r.hra, r.pf, r.esic, r.pt, r.mlwf, r.total,
  ]);

  const sheetData = [...header, [""], ...columns, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Wage Sheet");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: new Headers({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="wage-sheet-${period}${mode ? '-' + mode : ''}.xlsx"`,
      "Cache-Control": "no-store",
    }),
  });
}
