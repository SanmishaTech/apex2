import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';

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

    const body = await request.json();
    const { transferType, challanDate, fromSiteId, toSiteId, assetIds, challanCopyUrl, remarks } = body;

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
