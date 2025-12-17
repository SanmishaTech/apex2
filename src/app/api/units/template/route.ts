import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from 'xlsx';

// GET /api/units/template - Download Excel template for Units
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const templateData = [
      {
        'Unit Name*': '',
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column width
    const colWidths = [
      { wch: 30 }, // Unit Name*
    ];
    (ws as any)['!cols'] = colWidths;

    // Bold header row
    const range = XLSX.utils.decode_range((ws as any)['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!(ws as any)[cellAddress]) continue;
      if (!(ws as any)[cellAddress].s) (ws as any)[cellAddress].s = {};
      (ws as any)[cellAddress].s.font = { bold: true };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Units Template');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="units_template.xlsx"',
      },
    });
  } catch (e) {
    console.error('Units template generation error:', e);
    return ApiError('Failed to generate template');
  }
}
