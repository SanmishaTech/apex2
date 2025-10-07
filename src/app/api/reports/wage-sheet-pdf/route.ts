import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Build a simple PDF as a Uint8Array using TextEncoder
function makePdfFromLines(lines: string[]) {
  const enc = new TextEncoder();
  const objects: string[] = [];
  const header = "%PDF-1.4\n";

  // 1: Catalog
  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  // 2: Pages
  objects[2] = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  // 5: Font Helvetica
  objects[5] = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  const fontSize = 9;
  const left = 40;
  let y = 800 - 40;
  const leading = 12;
  const contentParts: string[] = [];
  contentParts.push("BT\n/F1 " + fontSize + " Tf\n");
  contentParts.push(`1 0 0 1 ${left} ${y} Tm\n`);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].replace(/\(/g, "[").replace(/\)/g, "]");
    if (i > 0) contentParts.push(`0 -${leading} Td\n`);
    contentParts.push(`(${t}) Tj\n`);
  }
  contentParts.push("ET\n");
  const contentStream = contentParts.join("");
  const contentLen = enc.encode(contentStream).length;
  objects[4] = `4 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`;

  // Page
  objects[3] = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";

  // Assemble
  const parts: string[] = [header];
  const offsets: number[] = [];
  let offset = header.length;
  for (let i = 1; i <= 5; i++) {
    offsets[i] = offset;
    const obj = objects[i];
    parts.push(obj);
    offset += obj.length;
  }
  const xrefStart = offset;
  const xref: string[] = [];
  xref.push("xref\n");
  xref.push("0 6\n");
  xref.push("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    xref.push(("0000000000" + offsets[i]).slice(-10) + " 00000 n \n");
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(xref.join(""));
  parts.push(trailer);

  return enc.encode(parts.join(""));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period");
    const mode = searchParams.get("mode");
    const siteId = searchParams.get("siteId");

    if (!period || !/^\d{2}-\d{4}$/.test(period)) {
      return NextResponse.json({ error: "Missing or invalid period (MM-YYYY)" }, { status: 400 });
    }

    // Build data directly (avoid cross-fetch to App Router to prevent 400)
    const govt = mode === "govt" ? true : mode === "company" ? false : undefined;

    const details = await prisma.paySlipDetail.findMany({
      where: {
        ...(siteId && siteId !== "all" ? { siteId: Number(siteId) } : {}),
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

    const lines: string[] = [];
    lines.push("ABCD COMPANY LTD        APEX Constructions");
    lines.push("Report: Monthly Wage Sheet" + (mode === "govt" ? " As Per Minimum Wage" : " As Per Company Rates"));
    lines.push(`Period: ${period}`);
    lines.push("");

    const headerLine = [
      "Site".padEnd(16),
      "Manpower".padEnd(18),
      "Supplier".padEnd(16),
      "Days".padStart(6),
      "Wage".padStart(10),
      "Gross".padStart(10),
      "HRA".padStart(8),
      "PF".padStart(8),
      "ESIC".padStart(8),
      "PT".padStart(8),
      "MLWF".padStart(8),
      "Total".padStart(10),
    ].join(" ");
    lines.push(headerLine);
    lines.push("".padEnd(headerLine.length, "-"));

    let sumDays = 0, sumGross = 0, sumHra = 0, sumPf = 0, sumEsic = 0, sumPt = 0, sumMlwf = 0, sumTotal = 0;
    for (const r of rows) {
      sumDays += Number(r.workingDays || 0);
      sumGross += Number(r.grossWages || 0);
      sumHra += Number(r.hra || 0);
      sumPf += Number(r.pf || 0);
      sumEsic += Number(r.esic || 0);
      sumPt += Number(r.pt || 0);
      sumMlwf += Number(r.mlwf || 0);
      sumTotal += Number(r.total || 0);
      const line = [
        String(r.siteName || '').slice(0, 16).padEnd(16),
        String(r.manpowerName || '').slice(0, 18).padEnd(18),
        String(r.supplier || '').slice(0, 16).padEnd(16),
        Number(r.workingDays || 0).toFixed(2).padStart(6),
        Number(r.wages || 0).toFixed(2).padStart(10),
        Number(r.grossWages || 0).toFixed(2).padStart(10),
        Number(r.hra || 0).toFixed(2).padStart(8),
        Number(r.pf || 0).toFixed(2).padStart(8),
        Number(r.esic || 0).toFixed(2).padStart(8),
        Number(r.pt || 0).toFixed(2).padStart(8),
        Number(r.mlwf || 0).toFixed(2).padStart(8),
        Number(r.total || 0).toFixed(2).padStart(10),
      ].join(" ");
      lines.push(line);
    }

    lines.push("".padEnd(headerLine.length, "-"));
    const totals = [
      "TOTALS".padEnd(50),
      sumDays.toFixed(2).padStart(6),
      "".padStart(10),
      sumGross.toFixed(2).padStart(10),
      sumHra.toFixed(2).padStart(8),
      sumPf.toFixed(2).padStart(8),
      sumEsic.toFixed(2).padStart(8),
      sumPt.toFixed(2).padStart(8),
      sumMlwf.toFixed(2).padStart(8),
      sumTotal.toFixed(2).padStart(10),
    ].join(" ");
    lines.push(totals);

    const pdfBytes = makePdfFromLines(lines);

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename=wage-sheet-${period}${mode ? '-' + mode : ''}.pdf`);
    headers.set("Cache-Control", "no-store");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to generate PDF" }, { status: 500 });
  }
}
