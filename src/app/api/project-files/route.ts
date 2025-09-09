import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// NOTE: This route treats files flatly. Optionally nest under /api/projects/:id/files.
// GET /api/project-files?projectId=1 (PROJECT_USER restricted to own membership)
export async function GET(req: NextRequest) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { user } = auth;
	const { searchParams } = new URL(req.url);
	const projectIdParam = searchParams.get('projectId');
	if (!projectIdParam) return Error('projectId required', 400);
	const projectId = Number(projectIdParam);
	if (Number.isNaN(projectId)) return Error('Invalid projectId', 400);

	// Membership check for project_user
	if (user.role === 'project_user') {
		const membership = await prisma.projectUser.findFirst({
			where: { projectId, userId: user.id },
			select: { id: true },
		});
		if (!membership) return Error('Forbidden', 403);
	}

	const files = await prisma.projectFile.findMany({
		where: { projectId },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			originalName: true,
			title: true,
			filename: true,
			mimeType: true,
			size: true,
			createdAt: true,
			uploadedById: true,
		},
	});
	return Success(files);
}

// POST /api/project-files  { projectId, originalName, mimeType, size, filename, storageKey?, url? }
// Actual binary upload should be handled by a signed URL or multipart route; this creates metadata row.
export async function POST(req: NextRequest) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { user } = auth;
	const contentType = req.headers.get('content-type') || '';
	let pid: number;
	let originalName: string | undefined;
	let mimeType: string | undefined;
	let size: number | undefined;
	let storedFilename: string | undefined;
	let title: string | undefined;
	let url: string | undefined; // not used for local storage, placeholder

	const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
	// Allow images, PDF, plain text, CSV, and Excel spreadsheets
	const ALLOWED_MIME_PREFIXES = [
		'image/',
		'application/pdf',
		'text/plain',
		'text/csv',
		'application/vnd.ms-excel', // .xls
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
	];

	if (contentType.includes('multipart/form-data')) {
		// Handle real file upload
		let form: FormData;
		try {
			form = await req.formData();
		} catch {
			return Error('Invalid multipart form data', 400);
		}
		const projectIdRaw = form.get('projectId');
		if (projectIdRaw == null) return Error('projectId required', 400);
		pid = Number(projectIdRaw);
		if (Number.isNaN(pid)) return Error('Invalid projectId', 400);
		const rawFile = form.get('file');
		// Avoid referencing global File directly (may be undefined in some Node builds)
		const isFileLike = (f: unknown): f is { name: string; type?: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } => {
			if (!f || typeof f !== 'object') return false;
			const obj = f as Record<string, unknown>;
			return typeof obj.name === 'string' && typeof obj.size === 'number' && typeof obj.arrayBuffer === 'function';
		};
		if (!isFileLike(rawFile)) return Error('file field required', 400);
		const file = rawFile;
		originalName = file.name;
		mimeType = file.type || 'application/octet-stream';
		size = file.size;
		if (size > MAX_FILE_SIZE) return Error('File too large', 413);
		if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType?.startsWith(p)))
			return Error('File type not allowed', 415);
		title = (form.get('title') as string) || undefined;
		if (!title || !title.trim()) return Error('title required', 400);
		// Generate deterministic unique filename
		const ext = path.extname(originalName) || '';
		storedFilename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
		// New structured path under /uploads/projects/<projectId>
		const uploadRoot = path.join(
			process.cwd(),
			'public',
			'uploads',
			'projects',
			String(pid),
			'files'
		);
		await fs.mkdir(uploadRoot, { recursive: true });
		const filePath = path.join(uploadRoot, storedFilename);
		try {
			const arrayBuffer = await file.arrayBuffer();
			await fs.writeFile(filePath, Buffer.from(arrayBuffer));
		} catch {
			return Error('Failed to save file', 500);
		}
	} else {
		// Fallback: accept JSON metadata (legacy pathway)
		let body: unknown;
		try {
			body = await req.json();
		} catch {
			return Error('Invalid JSON body', 400);
		}
		const {
			projectId,
			originalName: on,
			mimeType: mt,
			size: sz,
			filename,
			title: t,
		} = body as Partial<{
			projectId: number | string;
			originalName: string;
			mimeType: string;
			size: number;
			filename: string;
			title?: string;
		}>;
		if (projectId == null) return Error('projectId required', 400);
		pid = Number(projectId);
		if (Number.isNaN(pid)) return Error('Invalid projectId', 400);
		if (!on || !mt || !filename || typeof sz !== 'number' || !t || !t.trim())
			return Error('Missing file metadata', 400);
		originalName = on;
		mimeType = mt;
		size = sz;
		storedFilename = filename;
		title = t;
	}

	// Basic presence check after branching
	if (
		!originalName ||
		!mimeType ||
		!storedFilename ||
		typeof size !== 'number'
	) {
		return Error('Incomplete file data', 400);
	}

	// Membership enforcement for project_user (cannot upload anyway due to permission guard; double check safety)
	if (user.role === 'project_user') return Error('Forbidden', 403);

	try {
		// TODO: after running `prisma migrate dev` & regenerating client, include title in select.
		const created = await prisma.projectFile.create({
			data: {
				projectId: pid,
				originalName,
				title: title.trim(),
				mimeType,
				size,
				filename: storedFilename,
				storageKey: null,
				url: url || null,
				uploadedById: user.id,
			},
			select: {
				id: true,
				projectId: true,
				originalName: true,
				title: true,
				mimeType: true,
				size: true,
				filename: true,
				createdAt: true,
			},
		});
		return Success(created, 201);
	} catch {
		return Error('Failed to create file record');
	}
}

// DELETE /api/project-files  { id }
export async function DELETE(req: NextRequest) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;

	// Support id via JSON body or query string (?id=) to avoid errors when body is empty
	let fid: number | null = null;
	const contentType = req.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		try {
			const body = (await req.json()) as Partial<{ id: number | string }>;
			if (body?.id != null) fid = Number(body.id);
		} catch {
			// fall through, will attempt query param
		}
	}
	if (fid == null || Number.isNaN(fid)) {
		const { searchParams } = new URL(req.url);
		const qp = searchParams.get('id');
		if (qp) fid = Number(qp);
	}
	if (fid == null || Number.isNaN(fid)) return Error('id required', 400);

	try {
		// Get filename first for disk cleanup
		const record = await prisma.projectFile.findUnique({
			where: { id: fid },
			select: { id: true, filename: true, projectId: true },
		});
		if (!record) return Error('File not found', 404);
		const deleted = await prisma.projectFile.delete({
			where: { id: fid },
			select: { id: true, projectId: true },
		});
		// Attempt unlink (ignore failure)
		const uploadRoot = path.join(
			process.cwd(),
			'public',
			'uploads',
			'projects',
			String(record.projectId),
			'files'
		);
		if (record.filename && record.projectId != null) {
			const diskPath = path.join(uploadRoot, record.filename);
			fs.unlink(diskPath).catch(() => {});
		}
		return Success(deleted);
	} catch (e: unknown) {
		const err = e as { code?: string };
		if (err.code === 'P2025') return Error('File not found', 404);
		return Error('Failed to delete file');
	}
}
