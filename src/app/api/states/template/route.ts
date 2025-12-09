import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from 'xlsx';

// GET /api/states/template - Download Excel template
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const templateData = [
      {
        'State*': '',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 30 }];

    // Bold header
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      if (!ws[cellAddress].s) ws[cellAddress].s = {} as any;
      (ws[cellAddress].s as any).font = { bold: true };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'States Template');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="states_template.xlsx"',
      },
    });
  } catch (e) {
    console.error('States template generation error:', e);
    return ApiError('Failed to generate template');
  }
}
