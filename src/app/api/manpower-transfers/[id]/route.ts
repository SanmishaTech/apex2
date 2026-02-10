import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid manpower transfer ID' },
        { status: 400 }
      );
    }

    const transfer = await prisma.manpowerTransfer.findUnique({
      where: { id },
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
            manpower: {
              select: { 
                id: true, 
                firstName: true, 
                middleName: true,
                lastName: true, 
                mobileNumber: true,
                manpowerSupplier: { 
                  select: { id: true, supplierName: true } 
                }
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Manpower transfer not found' },
        { status: 404 }
      );
    }

    // Transform the response to flatten manpower data into transfer items
    const transformedTransfer = {
      ...transfer,
      transferItems: transfer.transferItems.map(item => ({
        id: item.id,
        manpowerId: item.manpowerId,
        // Flatten manpower personal details
        firstName: item.manpower.firstName,
        middleName: item.manpower.middleName,
        lastName: item.manpower.lastName,
        mobileNumber: item.manpower.mobileNumber,
        manpowerSupplier: item.manpower.manpowerSupplier,
        // Include assignment details from transfer item
        category: item.category,
        skillSet: item.skillSet,
        wage: item.wage,
        minWage: item.minWage,
        hours: item.hours,
        esic: item.esic,
        pf: item.pf,
        pt: item.pt,
        hra: item.hra,
        mlwf: item.mlwf,
      })),
    };

    return NextResponse.json(transformedTransfer);
  } catch (error) {
    console.error('Manpower transfer GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manpower transfer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid manpower transfer ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, approvedById, remarks } = body;

    // Check if transfer exists and is in a valid state for updates
    const existingTransfer = await prisma.manpowerTransfer.findUnique({
      where: { id },
      include: {
        transferItems: {
          include: {
            manpower: true,
          },
        },
      },
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Manpower transfer not found' },
        { status: 404 }
      );
    }

    // Handle status changes with business logic
    if (status && status !== existingTransfer.status) {
      if (existingTransfer.status !== 'Pending') {
        return NextResponse.json(
          { error: 'Only pending transfers can have their status changed' },
          { status: 400 }
        );
      }

      // Update transfer in a transaction to handle manpower assignment changes
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        const actionDate = new Date();

        // Update the transfer status
        const transfer = await tx.manpowerTransfer.update({
          where: { id },
          data: {
            status,
            approvedById: status !== 'Pending' ? approvedById : null,
            approvedAt: status !== 'Pending' ? actionDate : null,
            remarks,
          },
          include: {
            fromSite: { select: { id: true, site: true } },
            toSite: { select: { id: true, site: true } },
            approvedBy: { select: { id: true, name: true } },
            transferItems: {
              include: {
                manpower: {
                  select: {
                    id: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    mobileNumber: true,
                    manpowerSupplier: {
                      select: { id: true, supplierName: true },
                    },
                  },
                },
              },
            },
          },
        });

        // If approved, actually transfer the manpower to the new site
        // AND copy all assignment data from transfer items to manpower records
        if (status === 'Accepted') {
          // Update each manpower individually to preserve their specific assignment data
          await Promise.all(
            existingTransfer.transferItems.map(async (item) => {
              const assignedDate = actionDate;

              const previous = await tx.siteManpower.findUnique({
                where: { manpowerId: item.manpowerId },
                select: { siteId: true, manpowerId: true },
              });

              if (previous) {
                await tx.siteManpower.delete({ where: { manpowerId: item.manpowerId } });
                await tx.siteManpowerLog.updateMany({
                  where: {
                    manpowerId: item.manpowerId,
                    siteId: previous.siteId,
                    unassignedDate: null,
                  },
                  data: {
                    unassignedDate: new Date(),
                    unassignedById: guardResult.user.id,
                  },
                });
              }

              // Create a fresh assignment with details reset
              await tx.siteManpower.create({
                data: {
                  manpowerId: item.manpowerId,
                  siteId: existingTransfer.toSiteId,
                  assignedDate,
                  assignedById: guardResult.user.id,
                  // categoryId/skillsetId/wage/minWage/pf/esic/pt/hra/mlwf intentionally omitted to reset
                } as any,
              });

              await tx.siteManpowerLog.create({
                data: {
                  manpowerId: item.manpowerId,
                  siteId: existingTransfer.toSiteId,
                  assignedDate,
                  assignedById: guardResult.user.id,
                },
              });

              await tx.manpower.update({
                where: { id: item.manpowerId },
                data: {
                  isAssigned: true,
                },
              });
            })
          );
        }
        // If rejected, manpower stays at original site (no action needed)

        return transfer;
      });

      return NextResponse.json({
        message: `Manpower transfer ${status.toLowerCase()} successfully`,
        data: updatedTransfer,
      });
    } else {
      // Simple update for other fields
      const updatedTransfer = await prisma.manpowerTransfer.update({
        where: { id },
        data: {
          remarks,
        },
        include: {
          fromSite: { select: { id: true, site: true } },
          toSite: { select: { id: true, site: true } },
          approvedBy: { select: { id: true, name: true } },
          transferItems: {
            include: {
              manpower: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  mobileNumber: true,
                  manpowerSupplier: {
                    select: { id: true, supplierName: true },
                  },
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        message: 'Manpower transfer updated successfully',
        data: updatedTransfer,
      });
    }
  } catch (error) {
    console.error('Manpower transfer PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update manpower transfer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guardResult = await guardApiAccess(request);
    if (guardResult.ok === false) return guardResult.response;

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid manpower transfer ID' },
        { status: 400 }
      );
    }

    // Check if transfer exists and can be deleted
    const existingTransfer = await prisma.manpowerTransfer.findUnique({
      where: { id },
      select: { id: true, status: true, challanNo: true },
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Manpower transfer not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of pending transfers
    if (existingTransfer.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Only pending transfers can be deleted' },
        { status: 400 }
      );
    }

    // Delete the transfer (cascade will handle transfer items)
    await prisma.manpowerTransfer.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Manpower transfer deleted successfully',
    });
  } catch (error) {
    console.error('Manpower transfer DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete manpower transfer' },
      { status: 500 }
    );
  }
}
