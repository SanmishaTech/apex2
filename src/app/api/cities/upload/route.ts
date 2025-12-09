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

// POST /api/cities/upload - Upload Excel file and bulk create cities
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
    const records: { city: string; stateName?: string | null }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // header row is 1
      const city = val(row['City*'] ?? row['City'] ?? row['city']);
      const stateName = val(row['State'] ?? row['state'] ?? row['State Name'] ?? row['stateName']);
      if (!city) {
        errors.push(`Row ${rowNum}: City is required`);
        continue;
      }
      records.push({ city, stateName });
    }

    if (errors.length > 0) {
      const msg = `Found ${errors.length} validation error(s): ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ''}`;
      return ApiError(msg, 400);
    }

    // Normalize within file and dedupe by city name
    const unique = new Map<string, { city: string; stateName?: string | null }>();
    for (const r of records) {
      const key = r.city.trim();
      if (!unique.has(key)) unique.set(key, r);
    }
    const uniqueRecords = Array.from(unique.values());

    // Resolve state names to IDs (optional)
    const stateNames = Array.from(new Set(uniqueRecords.map(r => r.stateName).filter(Boolean))) as string[];
    const states = stateNames.length
      ? await prisma.state.findMany({ where: { state: { in: stateNames } }, select: { id: true, state: true } })
      : [];
    const stateMap = new Map(states.map(s => [s.state, s.id] as const));

    // Check for missing state names if provided
    const missingStates: string[] = [];
    for (const n of stateNames) if (!stateMap.has(n)) missingStates.push(n);
    if (missingStates.length > 0) {
      const list = missingStates.slice(0, 5).join(', ');
      const extra = missingStates.length > 5 ? ` and ${missingStates.length - 5} more` : '';
      return ApiError(`State name(s) not found: ${list}${extra}. Please create the states first or correct names.`, 400);
    }

    // Filter out existing cities to avoid unique conflicts
    const cityNames = uniqueRecords.map(r => r.city);
    const existing = await prisma.city.findMany({ where: { city: { in: cityNames } }, select: { city: true } });
    const existingSet = new Set(existing.map(e => e.city));

    const toInsert = uniqueRecords
      .filter(r => !existingSet.has(r.city))
      .map(r => ({ city: r.city, stateId: r.stateName ? stateMap.get(r.stateName) ?? undefined : undefined }));

    if (toInsert.length === 0) {
      return Success({ message: 'No new cities to import', count: 0 }, 200);
    }

    const result = await prisma.city.createMany({ data: toInsert, skipDuplicates: true });
    return Success({ message: `Successfully uploaded ${result.count} city(s)`, count: result.count }, 201);
  } catch (e: any) {
    console.error('Cities upload error:', e);
    return ApiError(e?.message || 'Failed to process uploaded file');
  }
}
