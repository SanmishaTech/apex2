import { NextRequest } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';
import { Error } from '@/lib/api-response';
import path from 'path';
import { promises as fs } from 'fs';

// GET /api/project-files/:id/download  -> returns binary file with auth/membership checks
export async function GET(
	req: NextRequest,
	ctx: { params: Promise<{ id: string }> }
) {
	const auth = await guardApiAccess(req);
	if (auth.ok === false) return auth.response; // permission enforced by access-control (READ_PROJECT_FILE)
	const { user } = auth;
	const { id } = await ctx.params;
	const fid = Number(id);
	if (Number.isNaN(fid)) return Error('Invalid id', 400);

	try {
		const fileRec = await prisma.projectFile.findUnique({
			where: { id: fid },
			select: {
				id: true,
				projectId: true,
				filename: true,
				originalName: true,
				mimeType: true,
				size: true,
			},
		});
		if (!fileRec) return Error('File not found', 404);
		if (user.role === 'project_user') {
			const membership = await prisma.projectUser.findFirst({
				where: { projectId: fileRec.projectId, userId: user.id },
				select: { id: true },
			});
			if (!membership) return Error('Forbidden', 403);
		}
		// New path
		const diskPath = path.join(
			process.cwd(),
			'public',
			'uploads',
			'projects',
			String(fileRec.projectId),
			'files',
			fileRec.filename
		);
		let stat;
		try {
			stat = await fs.stat(diskPath);
		} catch {
			return Error('File missing on disk', 410);
		}
		if (!stat.isFile()) return Error('File missing on disk', 410);
		let data: Buffer;
		try {
			data = await fs.readFile(diskPath);
		} catch {
			return Error('Failed to read file', 500);
		}
		const safeName = sanitizeFilename(fileRec.originalName);
		return new Response(new Uint8Array(data), {
			status: 200,
			headers: {
				'Content-Type': fileRec.mimeType || 'application/octet-stream',
				'Content-Length': String(data.length),
				'Content-Disposition': `attachment; filename="${safeName}"`,
				'Cache-Control': 'private, no-store',
			},
		});
	} catch {
		return Error('Failed to download');
	}
}

function sanitizeFilename(name: string) {
	return name.replace(/[\r\n"\\]+/g, '_').slice(0, 200) || 'download';
}
