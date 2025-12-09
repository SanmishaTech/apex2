import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from 'xlsx';

function val(v: any) {
  if (v == null || v === undefined) return null;
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

// POST /api/states/upload - Upload Excel file and bulk create states
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return ApiError('No file uploaded', 400);

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return ApiError('Invalid file type. Please upload an Excel file (.xlsx or .xls)', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return ApiError('Excel file is empty', 400);

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    if (!data || data.length === 0) return ApiError('No data found in Excel file', 400);

    const errors: string[] = [];
    const states: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // header is row 1
      const state = val(row['State*'] ?? row['State'] ?? row['state']);
      if (!state) {
        errors.push(`Row ${rowNum}: State is required`);
        continue;
      }
      states.push(state);
    }

    if (errors.length > 0) {
      const msg = `Found ${errors.length} validation error(s): ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ''}`;
      return ApiError(msg, 400);
    }

    // Normalize and de-duplicate within file (case-insensitive)
    const uniqueStates = Array.from(new Set(states.map(s => s.trim())));

    // Optionally filter out ones already existing to avoid unique conflicts
    const existing = await prisma.state.findMany({
      where: { state: { in: uniqueStates } },
      select: { state: true },
    });
    const existingSet = new Set(existing.map(e => e.state));
    const toInsert = uniqueStates.filter(s => !existingSet.has(s)).map(s => ({ state: s }));

    if (toInsert.length === 0) {
      return Success({ message: 'No new states to import', count: 0 }, 200);
    }

    const result = await prisma.state.createMany({ data: toInsert, skipDuplicates: true });
    return Success({ message: `Successfully uploaded ${result.count} state(s)`, count: result.count }, 201);
  } catch (e: any) {
    console.error('States upload error:', e);
    return ApiError(e?.message || 'Failed to process uploaded file');
  }
}
