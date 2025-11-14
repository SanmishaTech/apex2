import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('perPage') || '10', 10);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    const skip = (page - 1) * perPage;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { challanNo: { contains: search, mode: 'insensitive' as const } },
            { transferType: { contains: search, mode: 'insensitive' as const } },
            { status: { contains: search, mode: 'insensitive' as const } },
            { fromSite: { site: { contains: search, mode: 'insensitive' as const } } },
            { toSite: { site: { contains: search, mode: 'insensitive' as const } } },
            { remarks: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Get total count for pagination
    const total = await prisma.assetTransfer.count({ where });

    // Get paginated results with relations
    const assetTransfers = await prisma.assetTransfer.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { [sort]: order },
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
      },
    });

    const totalPages = Math.ceil(total / perPage);

    return NextResponse.json({
      data: assetTransfers,
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Asset transfers GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset transfers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const contentType = request.headers.get('content-type') || '';
    let transferType: string;
    let challanDate: string;
    let fromSiteId: number | null = null;
    let toSiteId: number;
    let assetIds: number[] = [];
    let challanCopyUrl: string | null = null;
    let remarks: string | null = null;
    let documentMetadata: Array<{ documentName: string; documentUrl?: string; index: number }> = [];
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
      transferType = String(form.get('transferType') || '');
      challanDate = String(form.get('challanDate') || '');
      const fromSiteStr = form.get('fromSiteId');
      const toSiteStr = form.get('toSiteId');
      fromSiteId = fromSiteStr ? Number(fromSiteStr) : null;
      toSiteId = toSiteStr ? Number(toSiteStr) : (NaN as any);
      remarks = (form.get('remarks') as string) || null;

      // assetIds can be JSON or repeated fields assetIds[]
      const assetIdsRaw = form.get('assetIds');
      if (typeof assetIdsRaw === 'string') {
        try {
          const parsed = JSON.parse(assetIdsRaw);
          if (Array.isArray(parsed)) assetIds = parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        } catch {}
      }
      if (assetIds.length === 0) {
        const alt: number[] = [];
        form.forEach((v, k) => {
          if (k === 'assetIds[]' || k === 'assetIds') {
            const n = Number(v as string);
            if (Number.isFinite(n)) alt.push(n);
          }
        });
        if (alt.length > 0) assetIds = alt;
      }

      // challan copy file
      const challanCopyFile = form.get('challanCopy') as File;
      if (challanCopyFile && challanCopyFile.size > 0) {
        const saved = await saveTransferDoc(challanCopyFile);
        if (saved) challanCopyUrl = saved;
      } else {
        const challanCopyUrlStr = form.get('challanCopyUrl');
        challanCopyUrl = challanCopyUrlStr ? String(challanCopyUrlStr) : null;
      }

      // documents metadata
      const docsJson = form.get('assetTransferDocuments');
      if (typeof docsJson === 'string' && docsJson.trim() !== '') {
        try {
          const parsed = JSON.parse(docsJson);
          if (Array.isArray(parsed)) {
            documentMetadata = parsed
              .filter((d: any) => d && typeof d === 'object')
              .map((d: any, index: number) => ({
                documentName: String(d.documentName || ''),
                documentUrl: typeof d.documentUrl === 'string' ? d.documentUrl : undefined,
                index,
              }));
          }
        } catch {}
      }
      // files: assetTransferDocuments[n][documentFile]
      form.forEach((value, key) => {
        const m = key.match(/^assetTransferDocuments\[(\d+)\]\[documentFile\]$/);
        if (!m) return;
        const idx = Number(m[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) documentFiles.push({ index: idx, file: fileVal });
      });
    } else {
      const body = await request.json();
      transferType = body.transferType;
      challanDate = body.challanDate;
      fromSiteId = body.fromSiteId ?? null;
      toSiteId = body.toSiteId;
      assetIds = Array.isArray(body.assetIds) ? body.assetIds : [];
      challanCopyUrl = body.challanCopyUrl ?? null;
      remarks = body.remarks ?? null;
      documentMetadata = Array.isArray(body.assetTransferDocuments)
        ? body.assetTransferDocuments.map((d: any, index: number) => ({
            documentName: String(d?.documentName || ''),
            documentUrl: typeof d?.documentUrl === 'string' ? d.documentUrl : undefined,
            index,
          }))
        : [];
    }

    // Validate required fields
    if (!transferType || !challanDate || !toSiteId || !assetIds || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: transferType, challanDate, toSiteId, assetIds' },
        { status: 400 }
      );
    }

    // For Transfer type, fromSiteId is required
    if (transferType === 'Transfer' && !fromSiteId) {
      return NextResponse.json(
        { error: 'fromSiteId is required for Transfer type' },
        { status: 400 }
      );
    }

    // Generate challan number
    const lastTransfer = await prisma.assetTransfer.findFirst({
      orderBy: { id: 'desc' },
      select: { challanNo: true },
    });

    let nextNumber = 1;
    if (lastTransfer?.challanNo) {
      const match = lastTransfer.challanNo.match(/CHN-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const challanNo = `CHN-${nextNumber.toString().padStart(5, '0')}`;

    // Check if assets are available for transfer based on business rules
    const assetsToTransfer = await prisma.asset.findMany({
      where: {
        id: { in: assetIds },
        ...(transferType === 'New Assign' 
          ? { 
              transferStatus: 'Available' // Only available assets can be newly assigned
            } 
          : { 
              transferStatus: 'Assigned', // Only assigned assets can be transferred
              currentSiteId: fromSiteId   // Must be at the specified from site
            }
        ),
      },
    });

    if (assetsToTransfer.length !== assetIds.length) {
      const errorMessage = transferType === 'New Assign' 
        ? 'Some assets are not available for assignment. Only assets with "Available" status can be newly assigned.'
        : 'Some assets are not available for transfer. Only assets with "Assigned" status at the specified from site can be transferred.';
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Create asset transfer with items in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the asset transfer
      const assetTransfer = await tx.assetTransfer.create({
        data: {
          challanNo,
          challanDate: new Date(challanDate),
          transferType,
          fromSiteId: transferType === 'Transfer' ? fromSiteId : null,
          toSiteId,
          status: 'Pending',
          challanCopyUrl,
          remarks,
        },
      });

      // Create transfer items
      const transferItems = await Promise.all(
        assetIds.map((assetId: number) =>
          tx.assetTransferItem.create({
            data: {
              assetTransferId: assetTransfer.id,
              assetId,
            },
          })
        )
      );

      // Update asset transfer status to In Transit
      await tx.asset.updateMany({
        where: { id: { in: assetIds } },
        data: { transferStatus: 'In Transit' },
      });

      // Create documents if provided
      if (documentMetadata.length > 0 || documentFiles.length > 0) {
        const filesByIndex = new Map<number, File>();
        documentFiles.forEach(({ index, file }) => filesByIndex.set(index, file));
        const toCreate: Array<{ assetTransferId: number; documentName: string; documentUrl: string }>= [];
        for (const meta of documentMetadata) {
          const name = (meta.documentName || '').trim();
          const file = filesByIndex.get(meta.index ?? -1);
          let finalUrl = meta.documentUrl?.trim();
          if (file) {
            const saved = await saveTransferDoc(file);
            finalUrl = saved ?? finalUrl;
          }
          if (!name || !finalUrl) continue;
          toCreate.push({ assetTransferId: assetTransfer.id, documentName: name, documentUrl: finalUrl });
        }
        if (toCreate.length > 0) {
          await tx.assetTransferDocument.createMany({ data: toCreate });
        }
      }

      return { assetTransfer, transferItems };
    });

    // Fetch the created transfer with relations
    const createdTransfer = await prisma.assetTransfer.findUnique({
      where: { id: result.assetTransfer.id },
      include: {
        fromSite: {
          select: { id: true, site: true, shortName: true },
        },
        toSite: {
          select: { id: true, site: true, shortName: true },
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
      },
    });

    return NextResponse.json(createdTransfer, { status: 201 });
  } catch (error) {
    console.error('Asset transfers POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create asset transfer' },
      { status: 500 }
    );
  }
}
