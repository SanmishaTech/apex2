import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/config/roles';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: Context) {
  const auth = await guardApiAccess(req, [PERMISSIONS.READ_MANPOWER_ASSIGNMENTS]);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await context.params;
    const assignmentId = parseInt(id, 10);

    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Invalid assignment ID' },
        { status: 400 }
      );
    }

    const assignment = await prisma.manpowerAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        site: {
          select: {
            id: true,
            site: true,
            shortName: true,
          }
        },
        manpower: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            category: true,
            skillSet: true,
            wage: true,
            mobileNumber: true,
            manpowerSupplier: {
              select: {
                id: true,
                supplierName: true,
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Manpower assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(assignment);

  } catch (error) {
    console.error('Manpower assignment GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manpower assignment' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  const auth = await guardApiAccess(req, [PERMISSIONS.EDIT_MANPOWER_ASSIGNMENTS]);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await context.params;
    const assignmentId = parseInt(id, 10);
    const body = await req.json();

    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Invalid assignment ID' },
        { status: 400 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.manpowerAssignment.findUnique({
      where: { id: assignmentId },
      include: { manpower: true }
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Manpower assignment not found' },
        { status: 404 }
      );
    }

    // Update assignment (typically used to deactivate)
    const updatedAssignment = await prisma.$transaction(async (tx) => {
      const assignment = await tx.manpowerAssignment.update({
        where: { id: assignmentId },
        data: {
          isActive: body.isActive ?? existingAssignment.isActive,
        },
        include: {
          site: {
            select: {
              id: true,
              site: true,
              shortName: true,
            }
          },
          manpower: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              category: true,
              skillSet: true,
            }
          }
        }
      });

      // If deactivating assignment, update manpower status
      if (body.isActive === false) {
        await tx.manpower.update({
          where: { id: existingAssignment.manpowerId },
          data: {
            isAssigned: false,
            currentSiteId: null,
          },
        });
      }

      return assignment;
    });

    return NextResponse.json(updatedAssignment);

  } catch (error) {
    console.error('Manpower assignment PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update manpower assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  const auth = await guardApiAccess(req, [PERMISSIONS.DELETE_MANPOWER_ASSIGNMENTS]);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await context.params;
    const assignmentId = parseInt(id, 10);

    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Invalid assignment ID' },
        { status: 400 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.manpowerAssignment.findUnique({
      where: { id: assignmentId },
      include: { manpower: true }
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Manpower assignment not found' },
        { status: 404 }
      );
    }

    // Delete assignment and update manpower status
    await prisma.$transaction(async (tx) => {
      // Delete the assignment
      await tx.manpowerAssignment.delete({
        where: { id: assignmentId },
      });

      // Update manpower to unassigned status
      await tx.manpower.update({
        where: { id: existingAssignment.manpowerId },
        data: {
          isAssigned: false,
          currentSiteId: null,
        },
      });
    });

    return NextResponse.json({ 
      success: true,
      message: 'Manpower assignment deleted successfully' 
    });

  } catch (error) {
    console.error('Manpower assignment DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete manpower assignment' },
      { status: 500 }
    );
  }
}
