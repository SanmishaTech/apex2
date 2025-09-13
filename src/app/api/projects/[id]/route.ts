import { NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/projects/:id (membership restricted for project_user)
export async function GET(
	req: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { user } = auth;
	const { id } = await context.params;
	const pid = Number(id);
	if (Number.isNaN(pid)) return Error('Invalid id', 400);

	try {
		const project = await prisma.project.findUnique({
			where: { id: pid },
			include: {
				users: { select: { userId: true } },
				_count: { select: { files: true } },
			},
		});
		if (!project) return Error('Project not found', 404);
		if (
			user.role === 'project_user' &&
			!project.users.some((u) => u.userId === user.id)
		) {
			return Error('Forbidden', 403);
		}
		return Success({ ...project, users: undefined });
	} catch {
		return Error('Failed to fetch project');
	}
}

// PATCH /api/projects/:id  (Admin only via UPDATE_PROJECT permission)
export async function PATCH(
	req: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { id } = await context.params;
	const pid = Number(id);
	if (Number.isNaN(pid)) return Error('Invalid id', 400);
	const contentType = req.headers.get('content-type') || '';
		const data: Record<string, unknown> = {};
		let newDesignImageFilename: string | null = null;
		let oldDesignImage: string | null = null;
	if (contentType.includes('multipart/form-data')) {
		let form: FormData;
		try {
			form = await req.formData();
		} catch {
			return Error('Invalid multipart form data', 400);
		}
		const name = form.get('name');
		const clientName = form.get('clientName');
		const location = form.get('location');
		const description = form.get('description');
		if (typeof name === 'string') data.name = name;
		if (typeof clientName === 'string') data.clientName = clientName;
		if (typeof location === 'string') data.location = location || null;
		if (typeof description === 'string') data.description = description || null;
		const file = form.get('designImageFile');
		const isFileLike = (
			f: unknown
		): f is {
			name: string;
			size: number;
			type?: string;
			arrayBuffer: () => Promise<ArrayBuffer>;
		} => {
			if (!f || typeof f !== 'object') return false;
			const o = f as Record<string, unknown> & { arrayBuffer?: unknown };
			return (
				typeof o.name === 'string' &&
				typeof o.size === 'number' &&
				typeof o.arrayBuffer === 'function'
			);
		};
			if (isFileLike(file)) {
				if (!file.type?.startsWith('image/')) return Error('Design image must be an image', 415);
				if (file.size > 20 * 1024 * 1024) return Error('Design image too large (max 20MB)', 413);
				const ext = path.extname(file.name) || '.png';
				newDesignImageFilename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
				const dir = path.join(process.cwd(), 'public', 'uploads', 'projects', String(pid), 'designs');
				await fs.mkdir(dir, { recursive: true });
				try { await fs.writeFile(path.join(dir, newDesignImageFilename), Buffer.from(await file.arrayBuffer())); }
				catch { return Error('Failed to store design image', 500); }
				// Get old for cleanup later
				const existing = await prisma.project.findUnique({ where: { id: pid }, select: { designImage: true } });
				oldDesignImage = existing?.designImage || null;
				data.designImage = newDesignImageFilename;
			}
	} else {
		let body: unknown;
		try {
			body = await req.json();
		} catch {
			return Error('Invalid JSON body', 400);
		}
		const { name, clientName, location, description, designImage } =
			body as Partial<{
				name: string;
				clientName: string;
				location?: string;
				description?: string;
				designImage?: string;
			}>;
		if (typeof name === 'string') data.name = name;
		if (typeof clientName === 'string') data.clientName = clientName;
		if (typeof location === 'string') data.location = location || null;
		if (typeof description === 'string') data.description = description || null;
		if (typeof designImage === 'string') data.designImage = designImage || null;
	}
	if (Object.keys(data).length === 0) return Error('Nothing to update', 400);

		try {
			await prisma.project.update({ where: { id: pid }, data });
			if (oldDesignImage && newDesignImageFilename && oldDesignImage !== newDesignImageFilename) {
				const oldPath = path.join(process.cwd(), 'public', 'uploads', 'projects', String(pid), 'designs', oldDesignImage);
				fs.unlink(oldPath).catch(() => {});
			}
		const fresh = await prisma.project.findUnique({
			where: { id: pid },
			include: {
				users: { select: { userId: true } },
				_count: { select: { files: true } },
			},
		});
		return Success(fresh ? { ...fresh, users: undefined } : null);
	} catch {
		return Error('Failed to update project');
	}
}

// DELETE /api/projects/:id  (Admin only via DELETE_PROJECT permission)
export async function DELETE(
	req: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response;
	const { id } = await context.params;
	const pid = Number(id);
	if (Number.isNaN(pid)) return Error('Invalid id', 400);
	try {
		await prisma.project.delete({ where: { id: pid } });
		return Success({ id: pid });
	} catch {
		return Error('Failed to delete project');
	}
}
