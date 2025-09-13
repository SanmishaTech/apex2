import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const createSchema = z.object({
  noticeHead: z.string().min(1),
  noticeHeading: z.string().min(1),
  noticeDescription: z.string().optional().nullable(),
  documentUrl: z.string().optional().nullable(),
});

// GET /api/notices?search=&page=1&perPage=10
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
    const search = (searchParams.get('search') || '').trim();

    const where = search
      ? {
          OR: [
            { noticeHead: { contains: search } },
            { noticeHeading: { contains: search } },
            { noticeDescription: { contains: search } },
          ],
        }
      : undefined;

    const result = await paginate({
      model: prisma.notice,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        noticeHead: true,
        noticeHeading: true,
        noticeDescription: true,
        documentUrl: true,
        createdAt: true,
      },
      page,
      perPage,
    });

    return Success(result);
  } catch (e) {
    return Error('Failed to fetch notices');
  }
}

// POST /api/notices - Create notice (supports multipart for document upload)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let data: Record<string, unknown> = {};
    let docFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      docFile = form.get('document') as File; // 'document' field name
      data = {
        noticeHead: form.get('noticeHead'),
        noticeHeading: form.get('noticeHeading'),
        noticeDescription: form.get('noticeDescription') || null,
      } as Record<string, unknown>;
    } else {
      data = await req.json();
    }

    let documentUrl: string | null = null;
    if (docFile && docFile.size > 0) {
      // allow common docs + images
      const allowed = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowed.includes(docFile.type || '')) {
        return Error('Unsupported file type', 415);
      }
      if (docFile.size > 20 * 1024 * 1024) {
        return Error('File too large (max 20MB)', 413);
      }
      const ext = path.extname(docFile.name) || '.bin';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'public', 'uploads', 'notices');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await docFile.arrayBuffer()));
      documentUrl = `/uploads/notices/${filename}`;
    }

    const input = createSchema.parse({ ...data, documentUrl });
    const created = await prisma.notice.create({ data: input, select: { id: true } });
    return Success(created, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return BadRequest(e.errors);
    }
    return Error('Failed to create notice');
  }
}

