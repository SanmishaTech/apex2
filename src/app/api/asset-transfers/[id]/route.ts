import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { id } = await context.params;
    const transferId = parseInt(id, 10);

    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'Invalid transfer ID' }, { status: 400 });
    }

    const assetTransfer = await prisma.assetTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromSite: {
          select: { id: true, site: true, shortName: true },
        },
        toSite: {
          select: { id: true, site: true, shortName: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
        transferItems: {
          include: {
            asset: {
              select: { 
                id: true, 
                assetNo: true, 
                assetName: true, 
                make: true,
                assetGroup: { select: { assetGroupName: true } },
                assetCategory: { select: { category: true } }
              },
            },
          },
        },
        assetTransferDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
      },
    });

    if (!assetTransfer) {
      return NextResponse.json({ error: 'Asset transfer not found' }, { status: 404 });
    }

    return NextResponse.json(assetTransfer);
  } catch (error) {
    console.error('Asset transfer GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset transfer' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { id } = await context.params;
    const transferId = parseInt(id, 10);

    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'Invalid transfer ID' }, { status: 400 });
    }

    const contentType = request.headers.get('content-type') || '';
    let status: string | undefined;
    let remarks: string | null | undefined;
    let approvedById: number | undefined;

    // If JSON, parse status early for approval flow
    let jsonBody: any = undefined;
    if (!contentType.includes('multipart/form-data')) {
      jsonBody = await request.json();
      status = jsonBody.status;
      remarks = jsonBody.remarks;
      approvedById = jsonBody.approvedById;
    }

    // Check if transfer exists
    const existingTransfer = await prisma.assetTransfer.findUnique({
      where: { id: transferId },
      include: {
        transferItems: true,
      },
    });

    if (!existingTransfer) {
      return NextResponse.json({ error: 'Asset transfer not found' }, { status: 404 });
    }

    // Handle status updates (approval/rejection)
    if (status && ['Accepted', 'Rejected'].includes(status)) {
      if (existingTransfer.status !== 'Pending') {
        return NextResponse.json(
          { error: 'Only pending transfers can be approved or rejected' },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        // Update transfer status
        const updatedTransfer = await tx.assetTransfer.update({
          where: { id: transferId },
          data: {
            status,
            approvedById,
            approvedAt: new Date(),
            remarks,
          },
        });

        const assetIds = existingTransfer.transferItems.map(item => item.assetId);

        if (status === 'Accepted') {
          // Update assets: set currentSiteId to toSiteId and transferStatus to Assigned
          await tx.asset.updateMany({
            where: { id: { in: assetIds } },
            data: {
              currentSiteId: existingTransfer.toSiteId,
              transferStatus: 'Assigned',
            },
          });
        } else if (status === 'Rejected') {
          // Revert assets: set transferStatus back to Available and restore fromSiteId if it was a transfer
          await tx.asset.updateMany({
            where: { id: { in: assetIds } },
            data: {
              transferStatus: 'Available',
              ...(existingTransfer.fromSiteId && {
                currentSiteId: existingTransfer.fromSiteId,
              }),
            },
          });
        }

        return updatedTransfer;
      });

      // Fetch updated transfer with relations
      const updatedTransfer = await prisma.assetTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromSite: {
            select: { id: true, site: true, shortName: true },
          },
          toSite: {
            select: { id: true, site: true, shortName: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
          transferItems: {
            include: {
              asset: {
                select: { 
                  id: true, 
                  assetNo: true, 
                  assetName: true, 
                  make: true,
                  assetGroup: { select: { assetGroupName: true } },
                  assetCategory: { select: { category: true } }
                },
              },
            },
          },
          assetTransferDocuments: {
            select: { id: true, documentName: true, documentUrl: true },
          },
        },
      });

      return NextResponse.json(updatedTransfer);
    }

    // Handle regular field updates (only if still pending)
    if (existingTransfer.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Cannot update approved or rejected transfers' },
        { status: 400 }
      );
    }

    // Parse input for regular updates
    let challanDate: string | undefined;
    let challanCopyUrl: string | null | undefined;
    let documentMetadata: Array<{ id?: number; documentName?: string; documentUrl?: string; index: number }> = [];
    const documentFiles: Array<{ index: number; file: File }> = [];

    const saveTransferDoc = async (file: File | null) => {
      if (!file || file.size === 0) return null;
      const allowed = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowed.includes(file.type || '')) throw new Error('Unsupported file type');
      if (file.size > 20 * 1024 * 1024) throw new Error('File too large (max 20MB)');
      const ext = path.extname(file.name) || '.bin';
      const filename = `${Date.now()}-asset-transfer-doc-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'uploads', 'asset-transfers');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      return `/uploads/asset-transfers/${filename}`;
    };

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      challanDate = (form.get('challanDate') as string) || undefined;
      remarks = (form.get('remarks') as string) || undefined;
      const challanCopyFile = form.get('challanCopy') as File;
      if (challanCopyFile && challanCopyFile.size > 0) {
        const saved = await saveTransferDoc(challanCopyFile);
        challanCopyUrl = saved ?? undefined;
      } else if (form.has('challanCopyUrl')) {
        challanCopyUrl = (form.get('challanCopyUrl') as string) ?? null;
      }

      const docsJson = form.get('assetTransferDocuments');
      if (typeof docsJson === 'string' && docsJson.trim() !== '') {
        try {
          const parsed = JSON.parse(docsJson);
          if (Array.isArray(parsed)) {
            documentMetadata = parsed
              .filter((d: any) => d && typeof d === 'object')
              .map((d: any, index: number) => ({
                id: typeof d.id === 'number' && Number.isFinite(d.id) ? d.id : undefined,
                documentName: typeof d.documentName === 'string' ? d.documentName : undefined,
                documentUrl: typeof d.documentUrl === 'string' ? d.documentUrl : undefined,
                index,
              }));
          }
        } catch {}
      }
      form.forEach((value, key) => {
        const m = key.match(/^assetTransferDocuments\[(\d+)\]\[documentFile\]$/);
        if (!m) return;
        const idx = Number(m[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) documentFiles.push({ index: idx, file: fileVal });
      });
    } else {
      challanDate = jsonBody?.challanDate;
      challanCopyUrl = jsonBody?.challanCopyUrl ?? undefined;
      remarks = jsonBody?.remarks ?? undefined;
      documentMetadata = Array.isArray(jsonBody?.assetTransferDocuments)
        ? jsonBody.assetTransferDocuments.map((d: any, index: number) => ({
            id: typeof d?.id === 'number' && Number.isFinite(d.id) ? d.id : undefined,
            documentName: typeof d?.documentName === 'string' ? d.documentName : undefined,
            documentUrl: typeof d?.documentUrl === 'string' ? d.documentUrl : undefined,
            index,
          }))
        : [];
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data: any = {};
      if (challanDate) data.challanDate = new Date(challanDate);
      if (remarks !== undefined) data.remarks = remarks;
      if (challanCopyUrl !== undefined) data.challanCopyUrl = challanCopyUrl;

      const updatedTransfer = await tx.assetTransfer.update({
        where: { id: transferId },
        data,
        select: { id: true },
      });

      // Documents create/update/delete
      if (documentMetadata.length > 0 || documentFiles.length > 0) {
        const filesByIndex = new Map<number, File>();
        documentFiles.forEach(({ index, file }) => filesByIndex.set(index, file));

        const existingDocs = await tx.assetTransferDocument.findMany({
          where: { assetTransferId: transferId },
          select: { id: true },
        });
        const existingIds = new Set(existingDocs.map((d) => d.id));

        const incomingById = new Map<number, { documentName: string; documentUrl: string }>();
        const toCreate: Array<{ assetTransferId: number; documentName: string; documentUrl: string }> = [];
        const toDelete: number[] = [];

        for (const meta of documentMetadata) {
          const name = meta.documentName?.trim() || '';
          const file = filesByIndex.get(meta.index ?? -1);
          const trimmedUrl = meta.documentUrl?.trim();
          let finalUrl = trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const saved = await saveTransferDoc(file);
            finalUrl = saved ?? finalUrl;
          }

          if (meta.id && existingIds.has(meta.id)) {
            if (!name || !finalUrl) {
              toDelete.push(meta.id);
              continue;
            }
            incomingById.set(meta.id, { documentName: name, documentUrl: finalUrl });
          } else {
            if (!name || !finalUrl) continue;
            toCreate.push({ assetTransferId: transferId, documentName: name, documentUrl: finalUrl });
          }
        }

        const incomingIds = new Set(incomingById.keys());
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) toDelete.push(existingId);
        }

        if (toCreate.length > 0) {
          await tx.assetTransferDocument.createMany({ data: toCreate });
        }
        for (const docId of incomingById.keys()) {
          const payload = incomingById.get(docId);
          if (!payload) continue;
          await tx.assetTransferDocument.update({
            where: { id: docId },
            data: { documentName: payload.documentName, documentUrl: payload.documentUrl },
          });
        }
        if (toDelete.length > 0) {
          await tx.assetTransferDocument.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      return updatedTransfer;
    });

    // Return with includes
    const updatedTransfer = await prisma.assetTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromSite: { select: { id: true, site: true, shortName: true } },
        toSite: { select: { id: true, site: true, shortName: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        transferItems: {
          include: {
            asset: {
              select: {
                id: true,
                assetNo: true,
                assetName: true,
                make: true,
                assetGroup: { select: { assetGroupName: true } },
                assetCategory: { select: { category: true } },
              },
            },
          },
        },
        assetTransferDocuments: { select: { id: true, documentName: true, documentUrl: true } },
      },
    });

    return NextResponse.json(updatedTransfer);
  } catch (error) {
    console.error('Asset transfer PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update asset transfer' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { id } = await context.params;
    const transferId = parseInt(id, 10);

    if (isNaN(transferId)) {
      return NextResponse.json({ error: 'Invalid transfer ID' }, { status: 400 });
    }

    // Check if transfer exists and is pending
    const existingTransfer = await prisma.assetTransfer.findUnique({
      where: { id: transferId },
      include: {
        transferItems: true,
      },
    });

    if (!existingTransfer) {
      return NextResponse.json({ error: 'Asset transfer not found' }, { status: 404 });
    }

    if (existingTransfer.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Cannot delete approved or rejected transfers' },
        { status: 400 }
      );
    }

    // Delete transfer and revert asset status in transaction
    await prisma.$transaction(async (tx) => {
      const assetIds = existingTransfer.transferItems.map(item => item.assetId);

      // Revert asset transfer status to Available
      await tx.asset.updateMany({
        where: { id: { in: assetIds } },
        data: { transferStatus: 'Available' },
      });

      // Delete transfer (will cascade delete transfer items)
      await tx.assetTransfer.delete({
        where: { id: transferId },
      });
    });

    return NextResponse.json({ message: 'Asset transfer deleted successfully' });
  } catch (error) {
    console.error('Asset transfer DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset transfer' },
      { status: 500 }
    );
  }
}
