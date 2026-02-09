import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest as ApiBadRequest, NotFound } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

function asStringDecimal(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? '1' : null;
  const n = typeof v === 'string' ? v : String(v);
  if (n.trim() === '') return null;
  return n as any; // Prisma Decimal accepts string
}

function asNonNegativeDecimal(v: unknown): string | null {
  const result = asStringDecimal(v);
  if (result === null) return null;
  const num = Number(result);
  if (Number.isNaN(num) || num < 0) return null; // Reject negative values
  return result;
}

function asDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const parsed = new Date(String(v));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Treat [id] as the manpower.id whose assignment fields live on the Manpower model
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(_req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return ApiBadRequest('Invalid id');

  try {
    const manpower = await prisma.manpower.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        supplierId: true,
        manpowerSupplier: { select: { id: true, supplierName: true } },
        mobileNumber: true,
        isAssigned: true,
        siteManpower: {
          select: {
            id: true,
            siteId: true,
            site: { select: { id: true, site: true, shortName: true } },
            assignedDate: true,
            assignedById: true,
            categoryId: true,
            skillsetId: true,
            category: { select: { id: true, categoryName: true } },
            skillset: { select: { id: true, skillsetName: true } },
            wage: true,
            minWage: true,
            pf: true,
            esic: true,
            hra: true,
            pt: true,
            mlwf: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!manpower) return NotFound('Manpower not found');
    return Success(manpower);
  } catch (e) {
    return ApiError('Failed to fetch manpower assignment');
  }
}

// Partial update of assignment fields for a single manpower
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return ApiBadRequest('Invalid id');

  try {
    const body = await req.json().catch(() => ({}));
    const assignmentData: any = {};

    if (body.categoryId !== undefined) {
      assignmentData.categoryId = body.categoryId === null ? null : Number(body.categoryId);
      if (assignmentData.categoryId !== null && !Number.isFinite(assignmentData.categoryId)) {
        return ApiBadRequest('Invalid categoryId');
      }
    }
    if (body.skillsetId !== undefined) {
      assignmentData.skillsetId = body.skillsetId === null ? null : Number(body.skillsetId);
      if (assignmentData.skillsetId !== null && !Number.isFinite(assignmentData.skillsetId)) {
        return ApiBadRequest('Invalid skillsetId');
      }
    }
    if (body.wage !== undefined) assignmentData.wage = asNonNegativeDecimal(body.wage) as any;
    if (body.minWage !== undefined) assignmentData.minWage = asNonNegativeDecimal(body.minWage) as any;
    if (body.pf !== undefined) assignmentData.pf = !!body.pf;
    if (body.esic !== undefined) assignmentData.esic = !!body.esic;
    if (body.hra !== undefined) assignmentData.hra = !!body.hra;
    if (body.pt !== undefined) assignmentData.pt = !!body.pt;
    if (body.mlwf !== undefined) assignmentData.mlwf = !!body.mlwf;
    if (body.assignedDate !== undefined) assignmentData.assignedDate = asDate(body.assignedDate);

    const hasAssignmentFieldUpdates = Object.keys(assignmentData).length > 0;
    const currentSiteIdProvided = body.currentSiteId !== undefined;

    if (!hasAssignmentFieldUpdates && !currentSiteIdProvided) {
      return ApiBadRequest('No fields to update');
    }

    await prisma.$transaction(async (tx) => {
      if (currentSiteIdProvided) {
        if (body.currentSiteId === null) {
          // Unassign: delete current assignment row and close the open log
          await tx.siteManpower.delete({ where: { manpowerId: id } }).catch(() => null);
          await tx.siteManpowerLog
            .updateMany({
              where: {
                manpowerId: id,
                unassignedDate: null,
              },
              data: {
                unassignedDate: new Date(),
                unassignedById: auth.user.id,
              },
            })
            .catch(() => null);
          await tx.manpower.update({ where: { id }, data: { isAssigned: false } });
          return;
        }

        const siteId = Number(body.currentSiteId);
        if (!Number.isFinite(siteId)) throw new Error('Invalid currentSiteId');

        const assignedDate = asDate(body.assignedDate) ?? new Date();

        // Create or update current assignment row
        await tx.siteManpower.upsert({
          where: { manpowerId: id },
          create: {
            manpowerId: id,
            siteId,
            assignedDate,
            assignedById: auth.user.id,
            ...(hasAssignmentFieldUpdates ? assignmentData : {}),
          },
          update: {
            siteId,
            ...(hasAssignmentFieldUpdates ? assignmentData : {}),
          },
        });

        // Ensure manpower marked assigned
        await tx.manpower.update({ where: { id }, data: { isAssigned: true } });

        // Create a history log row for this assignment
        await tx.siteManpowerLog.create({
          data: {
            manpowerId: id,
            siteId,
            assignedDate,
            assignedById: auth.user.id,
          },
        });
        return;
      }

      // Update fields only (site remains same)
      if (hasAssignmentFieldUpdates) {
        await tx.siteManpower.update({ where: { manpowerId: id }, data: assignmentData });
      }
    });

    return Success({ id, updated: true });
  } catch (e) {
    return ApiError('Failed to update manpower assignment');
  }
}

// Unassign manpower (clear assignment-related fields)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return ApiBadRequest('Invalid id');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.siteManpower.delete({ where: { manpowerId: id } }).catch(() => null);
      await tx.siteManpowerLog
        .updateMany({
          where: {
            manpowerId: id,
            unassignedDate: null,
          },
          data: {
            unassignedDate: new Date(),
            unassignedById: auth.user.id,
          },
        })
        .catch(() => null);
      await tx.manpower.update({ where: { id }, data: { isAssigned: false } });
    });
    return Success({ id, unassigned: true });
  } catch (e) {
    return ApiError('Failed to unassign manpower');
  }
}
