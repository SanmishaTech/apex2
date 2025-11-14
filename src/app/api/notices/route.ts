import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const createSchema = z.object({
  noticeHead: z.string().min(1),
  noticeHeading: z.string().min(1),
  noticeDescription: z.string().nullable().optional(),
  documentUrl: z.string().nullable().optional(),
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
      model: prisma.notice as any,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        noticeHead: true,
        noticeHeading: true,
        noticeDescription: true,
        documentUrl: true,
        noticeDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      page,
      perPage,
    });

    return Success({
      data: result.data,
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (e) {
    return ApiError('Failed to fetch notices');
  }
}

async function saveNoticeDoc(file: File | null) {
  if (!file || file.size === 0) return null;
  const allowed = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowed.includes(file.type || '')) {
    throw new Error('Unsupported file type');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('File too large (max 20MB)');
  }
  const ext = path.extname(file.name) || '.bin';
  const filename = `${Date.now()}-notice-doc-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), 'uploads', 'notices');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/notices/${filename}`;
}

// POST /api/notices - Create notice (supports multipart for document upload)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let data: Record<string, unknown> = {};
    let docFile: File | null = null;
    let overrideDocumentUrl: string | null | undefined = undefined;
    let noticeDocumentMetadata: Array<{ id?: number; documentName: string; documentUrl?: string; index: number }> = [];
    const noticeDocumentFiles: Array<{ index: number; file: File }> = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      docFile = form.get('document') as File; // 'document' field name
      data = {
        noticeHead: String(form.get('noticeHead') || ''),
        noticeHeading: String(form.get('noticeHeading') || ''),
        noticeDescription: form.get('noticeDescription') ? String(form.get('noticeDescription')) : null,
      };

      const documentsJson = form.get('noticeDocuments');
      if (typeof documentsJson === 'string' && documentsJson.trim() !== '') {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            noticeDocumentMetadata = parsed
              .filter((doc: any) => doc && typeof doc === 'object')
              .map((doc: any, index: number) => ({
                id: typeof doc.id === 'number' && Number.isFinite(doc.id) ? doc.id : undefined,
                documentName: String(doc.documentName || ''),
                documentUrl:
                  typeof doc.documentUrl === 'string' && doc.documentUrl.trim() !== ''
                    ? doc.documentUrl
                    : undefined,
                index,
              }));
          }
        } catch (error) {
          console.warn('Failed to parse noticeDocuments metadata (POST)', error);
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^noticeDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) {
          noticeDocumentFiles.push({ index: idx, file: fileVal });
        }
      });
    } else {
      data = await req.json();
      if (Array.isArray((data as any)?.noticeDocuments)) {
        noticeDocumentMetadata = (data as any).noticeDocuments.map((doc: any, index: number) => ({
          id: typeof doc?.id === 'number' && Number.isFinite(doc.id) ? doc.id : undefined,
          documentName: String(doc?.documentName || ''),
          documentUrl:
            typeof doc?.documentUrl === 'string' && doc.documentUrl.trim() !== ''
              ? doc.documentUrl
              : undefined,
          index,
        }));
      }
      delete (data as any).noticeDocuments;
    }

    if (docFile && docFile.size > 0) {
      try {
        const saved = await saveNoticeDoc(docFile);
        overrideDocumentUrl = saved ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save document';
        return ApiError(message, 415);
      }
    }

    const parsedInput = createSchema.parse({
      ...data,
      ...(overrideDocumentUrl !== undefined ? { documentUrl: overrideDocumentUrl } : {}),
    });
    const created = await prisma.notice.create({ 
      data: {
        noticeHead: parsedInput.noticeHead,
        noticeHeading: parsedInput.noticeHeading,
        noticeDescription: parsedInput.noticeDescription,
        documentUrl: parsedInput.documentUrl,
      }, 
      select: { id: true } 
    });

    if (noticeDocumentMetadata.length > 0 || noticeDocumentFiles.length > 0) {
      const filesByIndex = new Map<number, File>();
      noticeDocumentFiles.forEach(({ index, file }) => filesByIndex.set(index, file));

      const createPayload: Array<{ noticeId: number; documentName: string; documentUrl: string }> = [];
      for (const docMeta of noticeDocumentMetadata) {
        const name = (docMeta.documentName || '').trim();
        const file = filesByIndex.get(docMeta.index ?? -1);
        const trimmedUrl = docMeta.documentUrl?.trim();
        let finalUrl = trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
        if (file) {
          try {
            finalUrl = (await saveNoticeDoc(file)) ?? undefined;
          } catch (error) {
            console.warn('Failed to save notice document file (POST)', error);
          }
        }
        if (!name || !finalUrl) continue;
        createPayload.push({ noticeId: created.id, documentName: name, documentUrl: finalUrl });
      }
      if (createPayload.length > 0) {
        await prisma.noticeDocument.createMany({ data: createPayload });
      }
    }

    return Success(created, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return BadRequest(e.errors);
    }
    return ApiError('Failed to create notice');
  }
}

