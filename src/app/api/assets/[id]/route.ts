import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const updateSchema = z.object({
  assetGroupId: z.number().int().positive().optional(),
  assetCategoryId: z.number().int().positive().optional(),
  assetName: z.string().min(1).optional(),
  make: z.string().optional(),
  description: z.string().optional(),
  purchaseDate: z.string().optional().nullable(),
  invoiceNo: z.string().optional(),
  supplier: z.string().optional(),
  invoiceCopyUrl: z.string().optional().nullable(),
  nextMaintenanceDate: z.string().optional().nullable(),
  status: z.string().optional(),
  useStatus: z.string().optional(),
});

// GET - Get individual asset
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const assetId = parseInt(id);
    if (isNaN(assetId)) return BadRequest("Invalid asset ID");

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        make: true,
        description: true,
        status: true,
        useStatus: true,
        purchaseDate: true,
        nextMaintenanceDate: true,
        supplier: true,
        invoiceNo: true,
        invoiceCopyUrl: true,
        assetGroupId: true,
        assetCategoryId: true,
        assetGroup: {
          select: {
            id: true,
            assetGroupName: true,
          }
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          }
        },
        createdAt: true,
        updatedAt: true,
        assetDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
      }
    });

    if (!asset) return NotFound('Asset not found');

    return Success(asset);
  } catch (error) {
    console.error("Get asset error:", error);
    return ApiError("Failed to fetch asset");
  }
}

// PATCH - Update asset
async function saveAssetDoc(file: File | null, subname: string) {
  if (!file || file.size === 0) return null;
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type || "")) throw new Error("Unsupported file type");
  if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20MB)");
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${subname}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", "assets");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/assets/${filename}`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const assetId = parseInt(id);
    if (isNaN(assetId)) return BadRequest("Invalid asset ID");

    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    let assetDocumentFiles: Array<{ index: number; file: File }> = [];
    let documentMetadata: Array<{ id?: number; documentName?: string; documentUrl?: string; index: number }> = [];
    let documentsProvided = false;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const get = (k: string) => form.get(k) as string | null;
      body = {
        assetGroupId: get('assetGroupId'),
        assetCategoryId: get('assetCategoryId'),
        assetName: get('assetName'),
        make: get('make'),
        description: get('description'),
        purchaseDate: get('purchaseDate'),
        invoiceNo: get('invoiceNo'),
        supplier: get('supplier'),
        invoiceCopyUrl: get('invoiceCopyUrl'),
        nextMaintenanceDate: get('nextMaintenanceDate'),
        status: get('status'),
        useStatus: get('useStatus'),
      };

      documentsProvided = form.has('assetDocuments');
      const documentsJson = form.get('assetDocuments');
      if (typeof documentsJson === 'string' && documentsJson.trim() !== '') {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            documentMetadata = parsed
              .filter((doc: any) => doc && typeof doc === 'object')
              .map((doc: any, index: number) => ({
                id: typeof doc.id === 'number' && Number.isFinite(doc.id) ? doc.id : undefined,
                documentName: typeof doc.documentName === 'string' ? doc.documentName : undefined,
                documentUrl: typeof doc.documentUrl === 'string' ? doc.documentUrl : undefined,
                index,
              }));
          }
        } catch (e) {
          console.warn('Failed to parse assetDocuments metadata (PATCH)', e);
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^assetDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) assetDocumentFiles.push({ index: idx, file: fileVal });
      });
    } else {
      body = await req.json();
      documentsProvided = Object.prototype.hasOwnProperty.call(body ?? {}, 'assetDocuments');
      documentMetadata = Array.isArray((body as any)?.assetDocuments)
        ? (body as any).assetDocuments.map((doc: any, index: number) => ({
            id: typeof doc?.id === 'number' && Number.isFinite(doc.id) ? doc.id : undefined,
            documentName: typeof doc?.documentName === 'string' ? doc.documentName : undefined,
            documentUrl: typeof doc?.documentUrl === 'string' ? doc.documentUrl : undefined,
            index,
          }))
        : [];
    }

    const validatedData = updateSchema.parse({
      ...body,
      assetGroupId: body.assetGroupId ? Number(body.assetGroupId) : body.assetGroupId,
      assetCategoryId: body.assetCategoryId ? Number(body.assetCategoryId) : body.assetCategoryId,
    });

    // Convert datetime strings to Date objects
    const updateData: any = { ...validatedData };
    
    if (validatedData.purchaseDate) {
      updateData.purchaseDate = new Date(validatedData.purchaseDate);
    }
    if (validatedData.nextMaintenanceDate) {
      updateData.nextMaintenanceDate = new Date(validatedData.nextMaintenanceDate);
    }

    // If updating asset group or category, verify they exist and are compatible
    if (validatedData.assetGroupId || validatedData.assetCategoryId) {
      // Get current asset to check relations
      const currentAsset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { assetGroupId: true, assetCategoryId: true }
      });
      
      if (!currentAsset) return NotFound('Asset not found');

      const finalAssetGroupId = validatedData.assetGroupId || currentAsset.assetGroupId;
      const finalAssetCategoryId = validatedData.assetCategoryId || currentAsset.assetCategoryId;

      // Verify asset group exists
      if (validatedData.assetGroupId) {
        const assetGroup = await prisma.assetGroup.findUnique({
          where: { id: validatedData.assetGroupId }
        });
        if (!assetGroup) {
          return BadRequest("Asset group not found");
        }
      }

      // Verify asset category exists and belongs to the asset group
      if (validatedData.assetCategoryId) {
        const assetCategory = await prisma.assetCategory.findUnique({
          where: { id: validatedData.assetCategoryId }
        });
        if (!assetCategory) {
          return BadRequest("Asset category not found");
        }
        if (assetCategory.assetGroupId !== finalAssetGroupId) {
          return BadRequest("Asset category does not belong to the selected asset group");
        }
      }
    }

    const hasDocumentOperations =
      documentsProvided || documentMetadata.length > 0 || assetDocumentFiles.length > 0;

    if (!Object.keys(updateData).length && !hasDocumentOperations) return BadRequest('Nothing to update');

    const updated = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.update({
        where: { id: assetId },
        data: updateData,
        select: { id: true },
      });

      if (hasDocumentOperations) {
        const filesByIndex = new Map<number, File>();
        assetDocumentFiles.forEach(({ index, file }) => filesByIndex.set(index, file));

        const existingDocs = await tx.assetDocument.findMany({
          where: { assetId },
          select: { id: true },
        });
        const existingIds = new Set(existingDocs.map((d) => d.id));

        const incomingById = new Map<number, { documentName: string; documentUrl: string }>();
        const toCreate: Array<{ assetId: number; documentName: string; documentUrl: string }> = [];
        const toDelete: number[] = [];

        for (const docMeta of documentMetadata) {
          const name = docMeta.documentName?.trim() || '';
          const file = filesByIndex.get(docMeta.index ?? -1);
          const trimmedUrl = docMeta.documentUrl?.trim();
          let finalUrl = trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const saved = await saveAssetDoc(file, 'asset-doc');
            finalUrl = saved ?? undefined;
          }

          if (docMeta.id && existingIds.has(docMeta.id)) {
            if (!name || !finalUrl) {
              toDelete.push(docMeta.id);
              continue;
            }
            incomingById.set(docMeta.id, { documentName: name, documentUrl: finalUrl });
          } else {
            if (!name || !finalUrl) continue;
            toCreate.push({ assetId, documentName: name, documentUrl: finalUrl });
          }
        }

        const incomingIds = new Set(incomingById.keys());
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) toDelete.push(existingId);
        }

        if (toCreate.length > 0) {
          await tx.assetDocument.createMany({ data: toCreate });
        }
        for (const docId of incomingById.keys()) {
          const payload = incomingById.get(docId);
          if (!payload) continue;
          await tx.assetDocument.update({
            where: { id: docId },
            data: { documentName: payload.documentName, documentUrl: payload.documentUrl },
          });
        }
        if (toDelete.length > 0) {
          await tx.assetDocument.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      return asset;
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if ((error as any)?.code === 'P2025') return NotFound('Asset not found');
    console.error("Update asset error:", error);
    return ApiError("Failed to update asset");
  }
}

// DELETE - Delete asset
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const assetId = parseInt(id);
    if (isNaN(assetId)) return BadRequest("Invalid asset ID");

    await prisma.asset.delete({
      where: { id: assetId }
    });

    return Success({ message: 'Asset deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return NotFound('Asset not found');
    console.error("Delete asset error:", error);
    return Error("Failed to delete asset");
  }
}
