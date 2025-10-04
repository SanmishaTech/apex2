import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET - Get all assigned manpower for a site with their last attendance
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const siteId = parseInt(id);

    if (isNaN(siteId)) {
      return BadRequest('Invalid site ID');
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, site: true },
    });

    if (!site) {
      return NotFound('Site not found');
    }

    // Get all assigned manpower for this site
    const manpower = await prisma.manpower.findMany({
      where: {
        isAssigned: true,
        currentSiteId: siteId,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        assignedAt: true,
      },
    });

    // Get last attendance for each manpower at this site
    const manpowerWithAttendance = await Promise.all(
      manpower.map(async (m) => {
        const lastAttendance = await prisma.attendance.findFirst({
          where: {
            siteId,
            manpowerId: m.id,
          },
          orderBy: { date: 'desc' },
          select: { date: true },
        });

        return {
          id: m.id,
          firstName: m.firstName,
          middleName: m.middleName,
          lastName: m.lastName,
          lastAttendance: lastAttendance?.date.toISOString() || null,
          assignedAt: m.assignedAt?.toISOString() || null,
          ot: 0,
          isPresent: false,
          isIdle: false,
        };
      })
    );

    return Success({
      site,
      manpower: manpowerWithAttendance,
    });
  } catch (error) {
    console.error('Get site manpower for attendance error:', error);
    return Error('Failed to fetch site manpower');
  }
}
