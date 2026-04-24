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
            ...({ foodCharges: true } as any),
            ...({ foodCharges2: true } as any),
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
    if (body.foodCharges !== undefined) assignmentData.foodCharges = asNonNegativeDecimal(body.foodCharges) as any;
    if (body.foodCharges2 !== undefined) assignmentData.foodCharges2 = asNonNegativeDecimal(body.foodCharges2) as any;
    if (body.pf !== undefined) assignmentData.pf = !!body.pf;
    if (body.esic !== undefined) assignmentData.esic = !!body.esic;
    if (body.hra !== undefined) assignmentData.hra = !!body.hra;
    if (body.pt !== undefined) assignmentData.pt = !!body.pt;
    if (body.mlwf !== undefined) assignmentData.mlwf = !!body.mlwf;
    if (body.assignedDate !== undefined) assignmentData.assignedDate = asDate(body.assignedDate);
    // Handle isPresent field
    const isPresentUpdate = body.isPresent !== undefined ? !!body.isPresent : undefined;

    const hasAssignmentFieldUpdates = Object.keys(assignmentData).length > 0 || isPresentUpdate !== undefined;
    const currentSiteIdProvided = body.currentSiteId !== undefined;

    if (!hasAssignmentFieldUpdates && !currentSiteIdProvided) {
      return ApiBadRequest('No fields to update');
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      if (currentSiteIdProvided) {
        if (body.currentSiteId === null) {
          // Unassign: update endDate on all open records, then delete, and close the open log
          const openRecords = await tx.siteManpower.findMany({
            where: { manpowerId: id, endDate: null },
            select: { id: true },
          });
          for (const record of openRecords) {
            await tx.siteManpower.update({
              where: { id: record.id },
              data: { endDate: now, isPresent: false },
            });
          }
          // Note: We intentionally keep all siteManpower records for historical tracking
          await tx.siteManpowerLog
            .updateMany({
              where: {
                manpowerId: id,
                unassignedDate: null,
              },
              data: {
                unassignedDate: now,
                unassignedById: auth.user.id,
              },
            })
            .catch(() => null);
          await tx.manpower.update({ where: { id }, data: { isAssigned: false } });
          return;
        }

        const siteId = Number(body.currentSiteId);
        if (!Number.isFinite(siteId)) throw new Error('Invalid currentSiteId');

        const assignedDate = asDate(body.assignedDate) ?? now;

        // Find existing active record for this manpower
        const existingRecord = await tx.siteManpower.findFirst({
          where: { manpowerId: id },
          orderBy: { id: 'desc' },
        });

        if (existingRecord) {
          // Update existing record with new site and fields
          await tx.siteManpower.update({
            where: { id: existingRecord.id },
            data: {
              siteId,
              assignedDate,
              ...(hasAssignmentFieldUpdates ? assignmentData : {}),
            },
          });
        } else {
          // Create new record - check if isPresent is set, if so set startDate
          const isPresent = isPresentUpdate ?? false;
          await tx.siteManpower.create({
            data: {
              manpowerId: id,
              siteId,
              assignedDate,
              assignedById: auth.user.id,
              isPresent,
              startDate: isPresent ? now : null,
              endDate: null,
              ...(hasAssignmentFieldUpdates ? assignmentData : {}),
            },
          });
        }

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

      // Update fields only (site remains same) - handle isPresent toggle
      if (hasAssignmentFieldUpdates || isPresentUpdate !== undefined) {
        // Find the 'open' record (endDate is null) - this is the currently active assignment
        let existing = await tx.siteManpower.findFirst({
          where: { manpowerId: id, endDate: null },
          orderBy: { id: 'desc' },
        });
        // If no open record, fall back to the most recent record
        if (!existing) {
          existing = await tx.siteManpower.findFirst({
            where: { manpowerId: id },
            orderBy: { id: 'desc' },
          });
        }

        if (existing) {
          // Check if isPresent is changing
          if (isPresentUpdate !== undefined && existing.isPresent !== isPresentUpdate) {
            if (isPresentUpdate) {
              // false -> true: If startDate is null, update existing; otherwise create new
              if (existing.startDate === null) {
                await tx.siteManpower.update({
                  where: { id: existing.id },
                  data: {
                    isPresent: true,
                    startDate: now,
                    ...assignmentData,
                  },
                });
              } else {
                await tx.siteManpower.create({
                  data: {
                    siteId: existing.siteId,
                    manpowerId: id,
                    isPresent: true,
                    startDate: now,
                    endDate: null,
                    assignedDate: existing.assignedDate,
                    assignedById: existing.assignedById,
                    categoryId: existing.categoryId,
                    skillsetId: existing.skillsetId,
                    wage: existing.wage,
                    minWage: existing.minWage,
                    foodCharges: existing.foodCharges,
                    foodCharges2: existing.foodCharges2,
                    pf: existing.pf,
                    esic: existing.esic,
                    pt: existing.pt,
                    hra: existing.hra,
                    mlwf: existing.mlwf,
                    ...assignmentData,
                  },
                });
              }
            } else {
              // true -> false: Update current record with endDate
              await tx.siteManpower.update({
                where: { id: existing.id },
                data: {
                  isPresent: false,
                  endDate: now,
                  ...assignmentData,
                },
              });
            }
          } else {
            // No isPresent change - just update other fields
            await tx.siteManpower.update({
              where: { id: existing.id },
              data: assignmentData,
            });
          }
        }
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
      const now = new Date();
      // Update endDate on all open records before deleting
      const openRecords = await tx.siteManpower.findMany({
        where: { manpowerId: id, endDate: null },
        select: { id: true },
      });
      for (const record of openRecords) {
        await tx.siteManpower.update({
          where: { id: record.id },
          data: { isAssigned: false, endDate: now, isPresent: false },
        });
      }
      // Note: We intentionally keep all siteManpower records for historical tracking
      await tx.siteManpowerLog
        .updateMany({
          where: {
            manpowerId: id,
            unassignedDate: null,
          },
          data: {
            unassignedDate: now,
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
