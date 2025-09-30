import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/config/roles';

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

    const body = await request.json();
    const { status, remarks, approvedById } = body;

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

    const updatedTransfer = await prisma.assetTransfer.update({
      where: { id: transferId },
      data: {
        ...(body.challanDate && { challanDate: new Date(body.challanDate) }),
        ...(body.challanCopyUrl !== undefined && { challanCopyUrl: body.challanCopyUrl }),
        ...(body.remarks !== undefined && { remarks: body.remarks }),
      },
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
