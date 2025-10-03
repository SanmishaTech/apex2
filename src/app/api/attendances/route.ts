import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { z } from 'zod';

// Schema for creating attendance
const createAttendanceSchema = z.object({
  date: z.string(),
  siteId: z.number().int().positive(),
  attendances: z.array(
    z.object({
      manpowerId: z.number().int().positive(),
      isPresent: z.boolean(),
      isIdle: z.boolean(),
      ot: z.number().optional(),
    })
  ),
});

// GET - List attendances with pagination & search
// Supports query params: page, perPage, search, siteId, date, manpowerId
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
    const search = searchParams.get('search')?.trim() || '';
    const siteId = searchParams.get('siteId');
    const date = searchParams.get('date');
    const manpowerId = searchParams.get('manpowerId');

    const where: any = {};

    // Filter by siteId if provided
    if (siteId) {
      const siteIdNum = parseInt(siteId);
      if (!isNaN(siteIdNum)) {
        where.siteId = siteIdNum;
      }
    }

    // Filter by date if provided (date-only comparison, ignoring time)
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Filter by manpowerId if provided
    if (manpowerId) {
      const manpowerIdNum = parseInt(manpowerId);
      if (!isNaN(manpowerIdNum)) {
        where.manpowerId = manpowerIdNum;
      }
    }

    // Search across manpower name or site name
    if (search) {
      where.OR = [
        {
          manpower: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          },
        },
        {
          site: {
            site: { contains: search },
          },
        },
      ];
    }

    const result = await paginate({
      model: prisma.attendance,
      where,
      orderBy: { date: 'desc' },
      page,
      perPage,
      select: {
        id: true,
        date: true,
        siteId: true,
        manpowerId: true,
        isPresent: true,
        isIdle: true,
        ot: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        manpower: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
    });

    return Success(result);
  } catch (error) {
    console.error('Get attendances error:', error);
    return Error('Failed to fetch attendances');
  }
}

// POST - Bulk create attendance for a site
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { date, siteId, attendances } = createAttendanceSchema.parse(body);

    const attendanceDate = new Date(date);

    // Use upsert to handle cases where attendance already exists for the date
    const results = await Promise.all(
      attendances.map((att) =>
        prisma.attendance.upsert({
          where: {
            date_siteId_manpowerId: {
              date: attendanceDate,
              siteId,
              manpowerId: att.manpowerId,
            },
          },
          update: {
            isPresent: att.isPresent,
            isIdle: att.isIdle,
            ot: att.ot !== undefined ? att.ot : null,
          },
          create: {
            date: attendanceDate,
            siteId,
            manpowerId: att.manpowerId,
            isPresent: att.isPresent,
            isIdle: att.isIdle,
            ot: att.ot !== undefined ? att.ot : null,
          },
          select: {
            id: true,
            date: true,
            siteId: true,
            manpowerId: true,
            isPresent: true,
            isIdle: true,
            ot: true,
          },
        })
      )
    );

    return Success({ count: results.length, attendances: results }, 201);
  } catch (error) {
    console.error('Create attendance error:', error);
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    return Error('Failed to create attendance');
  }
}
