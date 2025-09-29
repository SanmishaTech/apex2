import { NextRequest, NextResponse } from 'next/server';
import { guardApiAccess } from '@/lib/access-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/config/roles';
import { z } from 'zod';

// Validation schema for creating manpower assignments
const createManpowerAssignmentSchema = z.object({
  siteId: z.number().positive("Site ID is required"),
  manpowerIds: z.array(z.number().positive()).min(1, "At least one manpower must be selected"),
});

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req, [PERMISSIONS.READ_MANPOWER_ASSIGNMENTS]);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const siteId = searchParams.get("siteId");
    const manpowerSupplierId = searchParams.get("manpowerSupplierId");
    const isActive = searchParams.get("isActive");

    const where: any = {};
    
    // Apply filters
    if (siteId) {
      where.siteId = parseInt(siteId);
    }
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (manpowerSupplierId) {
      where.manpower = {
        supplierId: parseInt(manpowerSupplierId)
      };
    }
    
    if (search) {
      where.OR = [
        { site: { site: { contains: search } } },
        { manpower: { firstName: { contains: search } } },
        { manpower: { lastName: { contains: search } } },
        { manpower: { manpowerSupplier: { supplierName: { contains: search } } } },
      ];
    }

    // Get total count
    const total = await prisma.manpowerAssignment.count({ where });

    // Get paginated results with relations
    const assignments = await prisma.manpowerAssignment.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' },
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

    const totalPages = Math.ceil(total / perPage);

    return NextResponse.json({
      data: assignments,
      meta: {
        total,
        page,
        totalPages,
        perPage,
      },
    });

  } catch (error) {
    console.error('Manpower assignments GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manpower assignments' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req, [PERMISSIONS.CREATE_MANPOWER_ASSIGNMENTS]);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const validatedData = createManpowerAssignmentSchema.parse(body);
    const { siteId, manpowerIds } = validatedData;

    // Check if manpower are available (not assigned or assigned to other sites)
    const manpowerToAssign = await prisma.manpower.findMany({
      where: {
        id: { in: manpowerIds },
        isAssigned: false, // Only allow unassigned manpower
      },
    });

    if (manpowerToAssign.length !== manpowerIds.length) {
      return NextResponse.json(
        { error: 'Some manpower are already assigned or not found' },
        { status: 400 }
      );
    }

    // Check if site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 400 }
      );
    }

    // Create assignments and update manpower status in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the manpower assignments
      const assignments = await Promise.all(
        manpowerIds.map(async (manpowerId) => {
          return await tx.manpowerAssignment.create({
            data: {
              siteId,
              manpowerId,
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
                  wage: true,
                }
              }
            }
          });
        })
      );

      // Update manpower status to assigned
      await tx.manpower.updateMany({
        where: { id: { in: manpowerIds } },
        data: {
          isAssigned: true,
          currentSiteId: siteId,
        },
      });

      return assignments;
    });

    return NextResponse.json({
      data: result,
      message: `Successfully assigned ${manpowerIds.length} manpower to ${site.site}`,
    });

  } catch (error) {
    console.error('Manpower assignments POST error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create manpower assignments' },
      { status: 500 }
    );
  }
}
