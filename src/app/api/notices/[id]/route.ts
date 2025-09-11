import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';

const updateSchema = z.object({
  noticeHead: z.string().optional(),
  noticeHeading: z.string().optional(),
  noticeDescription: z.string().optional().nullable(),
  documentUrl: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) return BadRequest('Invalid id');
  try {
    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) return Error('Notice not found', 404);
    return Success(notice);
  } catch {
    return Error('Failed to fetch notice');
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) return BadRequest('Invalid id');

  try {
    const contentType = req.headers.get('content-type') || '';
    let data: Record<string, unknown> = {};
    let docFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      docFile = form.get('document') as File;
      data = {
        noticeHead: form.get('noticeHead') || undefined,
        noticeHeading: form.get('noticeHeading') || undefined,
        noticeDescription: form.get('noticeDescription') || null,
      } as Record<string, unknown>;
    } else {
      data = await req.json();
    }

    if (docFile && docFile.size > 0) {
      const allowed = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowed.includes(docFile.type || '')) return Error('Unsupported file type', 415);
      if (docFile.size > 20 * 1024 * 1024) return Error('File too large (max 20MB)', 413);

      const existing = await prisma.notice.findUnique({ where: { id }, select: { documentUrl: true } });
      const ext = path.extname(docFile.name) || '.bin';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'public', 'uploads', 'notices');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await docFile.arrayBuffer()));
      data.documentUrl = `/uploads/notices/${filename}`;
      if (existing?.documentUrl && existing.documentUrl.startsWith('/uploads/notices/')) {
        try { await fs.unlink(path.join(process.cwd(), 'public', existing.documentUrl)); } catch {}
      }
    }

    const input = updateSchema.parse(data);
    if (Object.keys(input).length === 0) return BadRequest('No valid fields to update');
    const updated = await prisma.notice.update({ where: { id }, data: input });
    return Success(updated);
  } catch {
    return Error('Failed to update notice');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) return BadRequest('Invalid id');
  try {
    const existing = await prisma.notice.findUnique({ where: { id }, select: { documentUrl: true } });
    await prisma.notice.delete({ where: { id } });
    if (existing?.documentUrl && existing.documentUrl.startsWith('/uploads/notices/')) {
      try { await fs.unlink(path.join(process.cwd(), 'public', existing.documentUrl)); } catch {}
    }
    return Success({ ok: true });
  } catch {
    return Error('Failed to delete notice');
  }
}


