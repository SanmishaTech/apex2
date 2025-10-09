import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { Success, Error as ApiError } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import * as XLSX from 'xlsx';

// Expected columns (case-insensitive header matching):
// Block, DefectType, ChainageFrom, ChainageTo, StartTime, EndTime, WidthMM, LengthMM, Remarks

// (legacy) header normalizer removed in this rewritten POST implementation

function parseTime(value: unknown): string | null {
	// Support Excel numeric time (fraction of a day)
	if (typeof value === 'number' && isFinite(value)) {
		const fraction = value % 1; // ignore whole days
		const totalSeconds = Math.round(fraction * 24 * 3600);
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		const s = totalSeconds % 60;
		return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
	}
	if (value == null) return null;
	const s = String(value).trim();
	if (!s) return null;
	// Accept formats like HH:MM:SS, M:SS, MM:SS, H:MM:SS, or textual '3 min 47 sec'
	if (/min|sec|hour/i.test(s)) {
		let h = 0,
			m = 0,
			sec = 0;
		const hM = s.match(/(\d+)\s*(?:h|hour)/i);
		if (hM) h = parseInt(hM[1]);
		const mM = s.match(/(\d+)\s*(?:m|min)/i);
		if (mM) m = parseInt(mM[1]);
		const sM = s.match(/(\d+)\s*(?:s|sec)/i);
		if (sM) sec = parseInt(sM[1]);
		return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
	}
	// If HH:MM:SS
	if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
		const parts = s.split(':').map(Number);
		return parts.map((n) => String(n).padStart(2, '0')).join(':');
	}
	// Two-part time (could be HH:MM or MM:SS). Heuristic: if first part > 23 treat as MM:SS, else assume HH:MM.
	if (/^\d{1,2}:\d{2}$/.test(s)) {
		const [a, b] = s.split(':');
		const ai = parseInt(a, 10);
		if (ai > 23) {
			return '00:' + a.padStart(2, '0') + ':' + b.padStart(2, '0');
		} else {
			return a.padStart(2, '0') + ':' + b.padStart(2, '0') + ':00';
		}
	}
	if (/^\d+$/.test(s)) {
		// seconds
		const sec = parseInt(s, 10);
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const s2 = sec % 60;
		return [h, m, s2].map((n) => String(n).padStart(2, '0')).join(':');
	}
	return null;
}

export async function GET(req: NextRequest) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;

	const { searchParams } = new URL(req.url);
	const projectId = Number(searchParams.get('projectId'));
	if (!projectId) return ApiError('projectId required', 400);

	const blockId = searchParams.get('blockId')
		? Number(searchParams.get('blockId'))
		: undefined;
	const defectType = searchParams.get('defectType') || undefined;
	const excludeMappedParam = searchParams.get('excludeMapped');
	const excludeMapped = excludeMappedParam === '1' || excludeMappedParam === 'true';
	const page = Number(searchParams.get('page') || '1');
	const pageSize = Math.min(100, Number(searchParams.get('pageSize') || '20'));
	const skip = (page - 1) * pageSize;

		const where: Prisma.CrackIdentificationWhereInput = { projectId };
	if (blockId) where.blockId = blockId;
	if (defectType) where.defectType = defectType;
			if (excludeMapped) where.DesignMap = null;

	const [items, total] = await Promise.all([
		prisma.crackIdentification.findMany({
			where,
			skip,
			take: pageSize,
			include: { block: true },
		}),
		prisma.crackIdentification.count({ where }),
	]);

	return Success({ items, total, page, pageSize });
}

export async function DELETE(req: NextRequest) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { searchParams } = new URL(req.url);
	const projectId = Number(searchParams.get('projectId'));
	if (!projectId) return ApiError('projectId required', 400);
	const blockId = searchParams.get('blockId')
		? Number(searchParams.get('blockId'))
		: undefined;
	const where: Record<string, unknown> = { projectId };
	if (blockId) where.blockId = blockId;
	const deleted = await prisma.crackIdentification.deleteMany({ where });
	return Success({ deleted: deleted.count });
}

export async function POST(req: NextRequest) {
	// Basic validation
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { searchParams } = new URL(req.url);
	const projectId = Number(searchParams.get('projectId'));
	if (!projectId) return ApiError('projectId required', 400);

	const form = await req.formData();
	const fileEntry = form.get('file');
	const isFileLike = (v: unknown): v is Blob & { name?: string } => {
		if (!v || typeof v !== 'object') return false;
		return 'arrayBuffer' in v && typeof (v as { arrayBuffer?: unknown }).arrayBuffer === 'function';
	};
	if (!isFileLike(fileEntry)) return ApiError('file required', 400);

	const wb = XLSX.read(await fileEntry.arrayBuffer(), { type: 'array' });
	if (!wb.SheetNames.length) return ApiError('no sheet', 400);
	const sheet = wb.Sheets[wb.SheetNames[0]];
	const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
	if (rows.length < 2) return ApiError('empty sheet', 400);

	// Fixed format column indices (0-based) based on provided sample
	const COL_BLOCK = 0;
	const COL_CHAINAGE_FROM = 1;
	const COL_CHAINAGE_TO = 2;
	const COL_RL = 3;
	const COL_DEFECT_TYPE = 4;
	const COL_LENGTH = 5; // L
	const COL_WIDTH = 6; // W
	const COL_HEIGHT = 7; // H
	const COL_VIDEO = 8;
	const COL_START = 9;
	const COL_END = 10;

	if (rows[0].length < 11) return ApiError('unexpected header format', 400);

	interface CrackRow { projectId: number; blockId: number; chainageFrom: string | null; chainageTo: string | null; rl: number | null; lengthMm: number | null; widthMm: number | null; heightMm: number | null; defectType: string | null; videoFileName: string | null; startTime: string | null; endTime: string | null; }
	const blockCache = new Map<string, number>();
	const cracks: CrackRow[] = [];
	const errors: { row: number; error: string }[] = [];
	let lastBlockName = '';
	let consecutiveEmptyContent = 0;
	let processedRows = 0;

	const num = (v: unknown): number | null => { if (v == null || String(v).trim()==='') return null; const n = Number(v); return isFinite(n)? n : null; };

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		if (!row) break;
		processedRows++;
		if (row.every(c => String(c ?? '').trim()==='')) {
			consecutiveEmptyContent++;
			if (consecutiveEmptyContent >= 5) break; // assume end of data block
			continue;
		}
		let blockName = String(row[COL_BLOCK] || '').trim();
		if (!blockName && lastBlockName) blockName = lastBlockName; // fill-down only if prior existed
		if (!blockName) { errors.push({ row: r+1, error: 'Block missing' }); continue; }
		lastBlockName = blockName;
		let blockId = blockCache.get(blockName);
		if (!blockId) {
			const existing = await prisma.block.findFirst({ where: { projectId, name: blockName } });
			if (existing) blockId = existing.id; else {
				const created = await prisma.block.create({ data: { projectId, name: blockName } });
				blockId = created.id;
			}
			blockCache.set(blockName, blockId);
		}
		const chainageFrom = (() => {
			const v = row[COL_CHAINAGE_FROM];
			if (v === 0) return '0';
			const s = String(v ?? '').trim();
			return s ? s : null;
		})();
		const chainageTo = (() => {
			const v = row[COL_CHAINAGE_TO];
			if (v === 0) return '0';
			const s = String(v ?? '').trim();
			return s ? s : null;
		})();
		const rl = num(row[COL_RL]);
		const defectType = String(row[COL_DEFECT_TYPE] || '').trim() || null;
		const lengthMm = num(row[COL_LENGTH]);
		const widthMm = num(row[COL_WIDTH]);
		const heightMm = num(row[COL_HEIGHT]);
		const videoFileName = String(row[COL_VIDEO] || '').trim() || null;
		const rawStart = row[COL_START];
		const rawEnd = row[COL_END];
		const startTime = parseTime(rawStart);
		const endTime = parseTime(rawEnd);
		const rawStartProvided = String(rawStart ?? '').trim() !== '';
		const rawEndProvided = String(rawEnd ?? '').trim() !== '';
		if (rawStartProvided && !startTime) { errors.push({ row: r+1, error: 'Invalid startTime format' }); continue; }
		if (rawEndProvided && !endTime) { errors.push({ row: r+1, error: 'Invalid endTime format' }); continue; }
		if (rawStartProvided !== rawEndProvided) { errors.push({ row: r+1, error: 'Both startTime and endTime required together' }); continue; }
		if (startTime && endTime && startTime > endTime) { errors.push({ row: r+1, error: 'startTime > endTime' }); continue; }
		// Accept only if meaningful defect/time/dimension data (RL alone not enough)
		const hasContent = !!(defectType || startTime || endTime || lengthMm || widthMm || heightMm || chainageFrom || chainageTo);
		if (!hasContent) {
			consecutiveEmptyContent++;
			if (consecutiveEmptyContent >= 5) break;
			continue; // skip decorative / filler row
		}
		consecutiveEmptyContent = 0; // reset because we accepted a content row
		cracks.push({ projectId, blockId, chainageFrom, chainageTo, rl, lengthMm, widthMm, heightMm, defectType, videoFileName, startTime, endTime });
	}

	if (!cracks.length) return ApiError('No valid data rows', 400);

	// Replace existing crack data for this project atomically
	const [deletedResult, createdResult] = await prisma.$transaction([
		prisma.crackIdentification.deleteMany({ where: { projectId } }),
		prisma.crackIdentification.createMany({ data: cracks })
	]);

	return Success({
		deleted: deletedResult.count,
		imported: createdResult.count,
		errors,
		processedRows,
		totalRows: rows.length - 1
	});
}
