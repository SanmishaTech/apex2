import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest } from '@/lib/api-response';
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) return BadRequest('Invalid id');
  try {
    const notice = await prisma.notice.findUnique({
      where: { id },
      include: {
        noticeDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
      },
    });
    if (!notice) return ApiError('Notice not found', 404);
    return Success(notice);
  } catch {
    return ApiError('Failed to fetch notice');
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
    let noticeDocumentsProvided = false;
    let noticeDocumentMetadata: Array<{ id?: number; documentName?: string; documentUrl?: string; index: number }> = [];
    const noticeDocumentFiles: Array<{ index: number; file: File }> = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      docFile = form.get('document') as File;
      data = {
        noticeHead: form.get('noticeHead') || undefined,
        noticeHeading: form.get('noticeHeading') || undefined,
        noticeDescription: form.get('noticeDescription') || null,
      } as Record<string, unknown>;

      noticeDocumentsProvided = form.has('noticeDocuments');
      const documentsJson = form.get('noticeDocuments');
      if (typeof documentsJson === 'string' && documentsJson.trim() !== '') {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            noticeDocumentMetadata = parsed
              .filter((doc: any) => doc && typeof doc === 'object')
              .map((doc: any, index: number) => ({
                id: typeof doc.id === 'number' && Number.isFinite(doc.id) ? doc.id : undefined,
                documentName: typeof doc.documentName === 'string' ? doc.documentName : undefined,
                documentUrl: typeof doc.documentUrl === 'string' ? doc.documentUrl : undefined,
                index,
              }));
          }
        } catch (error) {
          console.warn('Failed to parse noticeDocuments metadata (PATCH)', error);
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^noticeDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) noticeDocumentFiles.push({ index: idx, file: fileVal });
      });

      Object.keys(data).forEach((key) => {
        if (data[key] === undefined) delete data[key];
      });
    } else {
      data = await req.json();
      noticeDocumentsProvided = Object.prototype.hasOwnProperty.call(data ?? {}, 'noticeDocuments');
      if (Array.isArray((data as any)?.noticeDocuments)) {
        noticeDocumentMetadata = (data as any).noticeDocuments.map((doc: any, index: number) => ({
          id: typeof doc?.id === 'number' && Number.isFinite(doc.id) ? doc.id : undefined,
          documentName: typeof doc?.documentName === 'string' ? doc.documentName : undefined,
          documentUrl: typeof doc?.documentUrl === 'string' ? doc.documentUrl : undefined,
          index,
        }));
      }
      delete (data as any).noticeDocuments;
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
      if (!allowed.includes(docFile.type || '')) return ApiError('Unsupported file type', 415);
      if (docFile.size > 20 * 1024 * 1024) return ApiError('File too large (max 20MB)', 413);

      const existing = await prisma.notice.findUnique({ where: { id }, select: { documentUrl: true } });
      const ext = path.extname(docFile.name) || '.bin';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'uploads', 'notices');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await docFile.arrayBuffer()));
      data.documentUrl = `/uploads/notices/${filename}`;
      if (existing?.documentUrl && existing.documentUrl.startsWith('/uploads/notices/')) {
        try { await fs.unlink(path.join(process.cwd(), existing.documentUrl)); } catch {}
      }
    }

    const input = updateSchema.parse(data);

    const hasDocOps =
      noticeDocumentsProvided ||
      noticeDocumentMetadata.length > 0 ||
      noticeDocumentFiles.length > 0;

    if (Object.keys(input).length === 0 && !hasDocOps) {
      return BadRequest('No valid fields to update');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = Object.keys(input).length > 0
        ? await tx.notice.update({ where: { id }, data: input })
        : await tx.notice.findUniqueOrThrow({ where: { id } });

      if (hasDocOps) {
        const filesByIndex = new Map<number, File>();
        noticeDocumentFiles.forEach(({ index, file }) => filesByIndex.set(index, file));

        const existingDocs = await tx.noticeDocument.findMany({
          where: { noticeId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingDocs.map((doc) => doc.id));

        const incomingById = new Map<number, { documentName: string; documentUrl: string }>();
        const toCreate: Array<{ noticeId: number; documentName: string; documentUrl: string }> = [];
        const toDelete: number[] = [];

        for (const docMeta of noticeDocumentMetadata) {
          const name = docMeta.documentName?.trim() || '';
          const file = filesByIndex.get(docMeta.index ?? -1);
          const trimmedUrl = docMeta.documentUrl?.trim();
          let finalUrl = trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const saved = await (async () => {
              try {
                return await saveNoticeDoc(file);
              } catch (error) {
                console.warn('Failed to save notice document (PATCH)', error);
                return undefined;
              }
            })();
            finalUrl = saved ?? finalUrl;
          }

          if (docMeta.id && existingIds.has(docMeta.id)) {
            if (!name || !finalUrl) {
              toDelete.push(docMeta.id);
              continue;
            }
            incomingById.set(docMeta.id, { documentName: name, documentUrl: finalUrl });
          } else {
            if (!name || !finalUrl) continue;
            toCreate.push({ noticeId: id, documentName: name, documentUrl: finalUrl });
          }
        }

        const incomingIds = new Set(incomingById.keys());
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) toDelete.push(existingId);
        }

        if (toCreate.length > 0) {
          await tx.noticeDocument.createMany({ data: toCreate });
        }

        for (const [docId, payload] of incomingById.entries()) {
          await tx.noticeDocument.update({
            where: { id: docId },
            data: {
              documentName: payload.documentName,
              documentUrl: payload.documentUrl,
            },
          });
        }

        if (toDelete.length > 0) {
          await tx.noticeDocument.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      return updated;
    });

    return Success(result);
  } catch {
    return ApiError('Failed to update notice');
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
      try { await fs.unlink(path.join(process.cwd(), existing.documentUrl)); } catch {}
    }
    return Success({ ok: true });
  } catch {
    return ApiError('Failed to delete notice');
  }
}


