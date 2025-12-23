import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import { ROLES } from "@/config/roles";

// Schema for creating attendance
const createAttendanceSchema = z.object({
  date: z.string(),
  siteId: z.number().int().positive(),
  attendances: z.array(
    z.object({
      manpowerId: z.number().int().positive(),
      isPresent: z.boolean(),
      isIdle: z.boolean(),
      ot: z.number().optional().nullable(),
    })
  ),
});

// Schema for bulk editing attendance
const editAttendanceSchema = z.object({
  attendances: z.array(
    z.object({
      id: z.number().int().positive(),
      isPresent: z.boolean(),
      isIdle: z.boolean(),
      ot: z.number().optional().nullable(),
    })
  ),
});

// GET - List attendances with pagination & search
// Supports query params: page, perPage, search, siteId, date, fromDate, toDate, manpowerId
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const siteId = searchParams.get("siteId");
    const date = searchParams.get("date");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const manpowerId = searchParams.get("manpowerId");

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

    // Filter by date range if provided
    if (fromDate || toDate) {
      where.date = where.date || {};
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        where.date.gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
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

    // Site-based visibility: non-admin and non-projectDirector see only their assigned sites
    const role = auth.user.role;
    const isPrivileged =
      role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    let assignedSiteIds: number[] | null = null;
    const requestedSiteId = siteId ? parseInt(siteId) : null;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      assignedSiteIds = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      // If no site filter is provided and no assigned sites, return empty set
      if (
        !requestedSiteId &&
        (!assignedSiteIds || assignedSiteIds.length === 0)
      ) {
        return Success({
          data: [],
          meta: { page, perPage, total: 0, totalPages: 1 },
        });
      }

      if (requestedSiteId && !isNaN(requestedSiteId)) {
        // If requesting a specific site not among assignments, return empty
        if (assignedSiteIds && !assignedSiteIds.includes(requestedSiteId)) {
          return Success({
            data: [],
            meta: { page, perPage, total: 0, totalPages: 1 },
          });
        }
        // else keep where.siteId as already set above
      } else if (assignedSiteIds && assignedSiteIds.length > 0) {
        // No specific site requested; restrict to assigned sites
        where.siteId = { in: assignedSiteIds };
      }
    }

    const result = await paginate({
      model: prisma.attendance as any,
      where,
      orderBy: { date: "desc" },
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
            category: true,
            skillSet: true,
          },
        },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get attendances error:", error);
    return Error("Failed to fetch attendances");
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
      attendances.map((att) => {
        const derivedIsPresent = att.isIdle ? true : att.isPresent;
        return prisma.attendance.upsert({
          where: {
            date_siteId_manpowerId: {
              date: attendanceDate,
              siteId,
              manpowerId: att.manpowerId,
            },
          },
          update: {
            isPresent: derivedIsPresent,
            isIdle: att.isIdle,
            ot: att.ot !== undefined ? att.ot : null,
          },
          create: {
            date: attendanceDate,
            siteId,
            manpowerId: att.manpowerId,
            isPresent: derivedIsPresent,
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
        });
      })
    );

    return Success({ count: results.length, attendances: results }, 201);
  } catch (error) {
    console.error("Create attendance error:", error);
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    return Error("Failed to create attendance");
  }
}

// PATCH - Bulk edit attendance records
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { attendances } = editAttendanceSchema.parse(body);

    // Update each attendance record
    const results = await Promise.all(
      attendances.map((att) => {
        const derivedIsPresent = att.isIdle ? true : att.isPresent;
        return prisma.attendance.update({
          where: { id: att.id },
          data: {
            isPresent: derivedIsPresent,
            isIdle: att.isIdle,
            ot: att.ot !== undefined && att.ot !== null ? att.ot : null,
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
        });
      })
    );

    return Success({ count: results.length, attendances: results });
  } catch (error) {
    console.error("Edit attendance error:", error);
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    return Error("Failed to update attendance");
  }
}
