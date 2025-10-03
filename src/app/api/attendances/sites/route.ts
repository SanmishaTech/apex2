import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET - List all sites with last attendance date and manpower count
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
    const search = searchParams.get('search')?.trim() || '';

    const where: any = {};

    // Only show sites with assigned manpower
    where.assignedManpower = {
      some: {
        isAssigned: true,
      },
    };

    // Search across site name
    if (search) {
      where.site = { contains: search };
    }

    // Get total count
    const total = await prisma.site.count({ where });

    // Get sites
    const sites = await prisma.site.findMany({
      where,
      orderBy: { site: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        site: true,
        shortName: true,
        assignedManpower: {
          where: { isAssigned: true },
          select: { id: true },
        },
      },
    });

    // Get last attendance date for each site
    const sitesWithAttendance = await Promise.all(
      sites.map(async (site) => {
        const lastAttendance = await prisma.attendance.findFirst({
          where: { siteId: site.id },
          orderBy: { date: 'desc' },
          select: { date: true },
        });

        return {
          id: site.id,
          site: site.site,
          shortName: site.shortName,
          lastAttendanceDate: lastAttendance?.date.toISOString() || null,
          assignedManpowerCount: site.assignedManpower.length,
        };
      })
    );

    const totalPages = Math.ceil(total / perPage);

    return Success({
      data: sitesWithAttendance,
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Get sites for attendance error:', error);
    return Error('Failed to fetch sites');
  }
}
