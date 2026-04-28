import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest as ApiBadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';

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

async function resolveCategoryId(tx: any, raw: unknown): Promise<number | null> {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const name = String(raw).trim();
  if (!name) return null;
  const rec = await tx.category.findFirst({ where: { categoryName: name }, select: { id: true } });
  return rec?.id ?? null;
}

async function resolveSkillsetId(tx: any, raw: unknown): Promise<number | null> {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const name = String(raw).trim();
  if (!name) return null;
  const rec = await tx.skillSet.findFirst({ where: { skillsetName: name }, select: { id: true } });
  return rec?.id ?? null;
}

// GET /api/manpower-assignments?siteId=123&mode=assigned|available&supplierId=&search=&page=&perPage=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
    const search = (searchParams.get('search') || '').trim();
    const mode = (searchParams.get('mode') || 'assigned').toLowerCase();
    const siteId = Number(searchParams.get('siteId'));
    const supplierId = searchParams.get('supplierId');
    const sort = (searchParams.get('sort') || 'firstName');
    const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

    const where: any = {};
    if (mode === 'assigned') {
      if (!siteId || Number.isNaN(siteId)) return ApiBadRequest('siteId is required for mode=assigned');
      where.isAssigned = true;
      // Only show manpowers with isAssigned=true at this site
      where.siteManpower = { some: { siteId, isAssigned: true } };
    } else if (mode === 'available') {
      // Only unassigned manpower
      where.isAssigned = false;
    }

    if (supplierId) {
      const sid = Number(supplierId);
      if (!Number.isNaN(sid)) where.supplierId = sid;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { mobileNumber: { contains: search } },
        { manpowerSupplier: { supplierName: { contains: search } } },
      ];
    }

    const sortable = new Set(['firstName','lastName','mobileNumber','wage','createdAt']);
    const orderBy: Record<string,'asc'|'desc'> = sortable.has(sort) ? { [sort]: order } : { firstName: 'asc' };

    const result = await paginate({
      model: prisma.manpower as any,
      where,
      orderBy,
      page,
      perPage,
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
          where: mode === 'assigned' && siteId ? { siteId } : undefined,
          orderBy: { id: 'desc' },
          take: 1,
          select: {
            siteId: true,
            isPresent: true,
            wage: true,
            ...({ foodCharges: true } as any),
            ...({ foodCharges2: true } as any),
            pf: true,
            esic: true,
            pt: true,
            mlwf: true,
            assignedDate: true,
            category: { select: { id: true, categoryName: true } },
            skillset: { select: { id: true, skillsetName: true } },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    const normalized = {
      ...result,
      data: Array.isArray((result as any).data)
        ? (result as any).data.map((row: any) => {
            const sm = row?.siteManpower?.[0];
            return {
              ...row,
              // Back-compat keys used by older UI
              currentSiteId: sm?.siteId ?? null,
              assignedAt: sm?.assignedDate ?? null,
              wage: sm?.wage ?? null,
              foodCharges: sm?.foodCharges ?? null,
              foodCharges2: sm?.foodCharges2 ?? null,
              pf: sm?.pf ?? false,
              esic: sm?.esic ?? false,
              pt: sm?.pt ?? false,
              mlwf: sm?.mlwf ?? false,
              isPresent: sm?.isPresent ?? false,
              category: sm?.category?.categoryName ?? null,
              skillSet: sm?.skillset?.skillsetName ?? null,
            };
          })
        : (result as any).data,
    };

    return Success(normalized);
  } catch (e) {
    return ApiError('Failed to fetch manpower assignments');
  }
}

// POST /api/manpower-assignments  { siteId, items: [{ manpowerId, category, skillSet, wage, esic, pf, pt }] }
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    const siteId = Number(body?.siteId);
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (!siteId || Number.isNaN(siteId)) return ApiBadRequest('siteId is required');
    if (items.length === 0) return ApiBadRequest('items are required');

    const ids = items.map((i) => Number(i.manpowerId)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) return ApiBadRequest('Valid manpowerIds are required');

    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();

      const existing = await tx.manpower.findMany({
        where: { id: { in: ids } },
        select: { id: true, isAssigned: true },
      });
      const notAllowed = existing.filter((m) => m.isAssigned);
      if (notAllowed.length > 0) {
        throw new Error('Some manpower already assigned. Refresh and try again.');
      }

      for (const i of items) {
        const manpowerId = Number(i.manpowerId);
        if (!Number.isFinite(manpowerId)) continue;

        const categoryId = await resolveCategoryId(tx, i.categoryId ?? i.category);
        const skillsetId = await resolveSkillsetId(tx, i.skillsetId ?? i.skillSet);

        const isPresent = !!i.present;
        await tx.siteManpower.create({
          data: {
            siteId,
            manpowerId,
            isAssigned: true,
            isPresent,
            startDate: isPresent ? now : null,
            endDate: null,
            assignedDate: asDate(i.assignedAt) ?? now,
            assignedById: auth.user.id,
            categoryId,
            skillsetId,
            wage: asNonNegativeDecimal(i.wage) as any,
            foodCharges: asNonNegativeDecimal(i.foodCharges) as any,
            foodCharges2: asNonNegativeDecimal(i.foodCharges2) as any,
            pf: !!i.pf,
            esic: !!i.esic,
            pt: !!i.pt,
            mlwf: !!i.mlwf,
          } as any,
        });

        await tx.siteManpowerLog.create({
          data: {
            siteId,
            manpowerId,
            assignedDate: asDate(i.assignedAt) ?? now,
            assignedById: auth.user.id,
          },
        });

        await tx.manpower.update({
          where: { id: manpowerId },
          data: { isAssigned: true },
          select: { id: true },
        });
      }

      return items.length;
    });

    return Success({ count: updated }, 201);
  } catch (e: any) {
    return ApiError(e?.message || 'Failed to assign manpower');
  }
}

// PATCH /api/manpower-assignments  { siteId, items: [{ manpowerId, ...partialFields }] }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    const siteId = body?.siteId != null ? Number(body.siteId) : undefined;
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return ApiBadRequest('items are required');

    const updates = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let count = 0;
      for (const i of items) {
        const manpowerId = Number(i.manpowerId);
        if (!Number.isFinite(manpowerId)) continue;

        // Find the 'open' record (endDate is null) - this is the currently active assignment
        const openWhere: any = { manpowerId, endDate: null };
        if (siteId !== undefined) openWhere.siteId = siteId;
        let existing = await tx.siteManpower.findFirst({ where: openWhere });
        // If no open record, fall back to the most recent record
        if (!existing) {
          const where: any = { manpowerId };
          if (siteId !== undefined) where.siteId = siteId;
          existing = await tx.siteManpower.findFirst({ where, orderBy: { id: 'desc' } });
        }
        if (!existing) continue;

        const newIsPresent = i.present !== undefined ? !!i.present : existing.isPresent;
        const isPresentChanged = i.present !== undefined && existing.isPresent !== newIsPresent;

        // Handle isPresent toggle logic
        if (isPresentChanged) {
          if (newIsPresent) {
            // false -> true: If startDate is null, update existing; otherwise create new
            if (existing.startDate === null) {
              const updateData: any = {
                isPresent: true,
                startDate: now,
              };
              if (i.category !== undefined || i.categoryId !== undefined) {
                updateData.categoryId = await resolveCategoryId(tx, i.categoryId ?? i.category);
              }
              if (i.skillSet !== undefined || i.skillsetId !== undefined) {
                updateData.skillsetId = await resolveSkillsetId(tx, i.skillsetId ?? i.skillSet);
              }
              if (i.wage !== undefined) updateData.wage = asNonNegativeDecimal(i.wage) as any;
              if (i.foodCharges !== undefined) updateData.foodCharges = asNonNegativeDecimal(i.foodCharges) as any;
              if (i.foodCharges2 !== undefined) updateData.foodCharges2 = asNonNegativeDecimal(i.foodCharges2) as any;
              if (i.pf !== undefined) updateData.pf = !!i.pf;
              if (i.esic !== undefined) updateData.esic = !!i.esic;
              if (i.pt !== undefined) updateData.pt = !!i.pt;
              if (i.mlwf !== undefined) updateData.mlwf = !!i.mlwf;
              if (i.assignedAt !== undefined) updateData.assignedDate = asDate(i.assignedAt);
              await tx.siteManpower.update({ where: { id: existing.id }, data: updateData });
            } else {
              // Create new record with startDate = now
              const data: any = {
                siteId: existing.siteId,
                manpowerId,
                isAssigned: true,
                isPresent: true,
                startDate: now,
                endDate: null,
                assignedDate: existing.assignedDate,
                assignedById: existing.assignedById,
                categoryId: existing.categoryId,
                skillsetId: existing.skillsetId,
                wage: existing.wage,
                foodCharges: existing.foodCharges,
                foodCharges2: existing.foodCharges2,
                pf: existing.pf,
                esic: existing.esic,
                pt: existing.pt,
                mlwf: existing.mlwf,
              };
              if (i.category !== undefined || i.categoryId !== undefined) {
                data.categoryId = await resolveCategoryId(tx, i.categoryId ?? i.category);
              }
              if (i.skillSet !== undefined || i.skillsetId !== undefined) {
                data.skillsetId = await resolveSkillsetId(tx, i.skillsetId ?? i.skillSet);
              }
              if (i.wage !== undefined) data.wage = asNonNegativeDecimal(i.wage) as any;
              if (i.foodCharges !== undefined) data.foodCharges = asNonNegativeDecimal(i.foodCharges) as any;
              if (i.foodCharges2 !== undefined) data.foodCharges2 = asNonNegativeDecimal(i.foodCharges2) as any;
              if (i.pf !== undefined) data.pf = !!i.pf;
              if (i.esic !== undefined) data.esic = !!i.esic;
              if (i.pt !== undefined) data.pt = !!i.pt;
              if (i.mlwf !== undefined) data.mlwf = !!i.mlwf;
              if (i.assignedAt !== undefined) data.assignedDate = asDate(i.assignedAt);

              // Close old record with endDate and set isAssigned to false
              await tx.siteManpower.update({
                where: { id: existing.id },
                data: { isAssigned: false, endDate: now },
              });
              // Create new record
              await tx.siteManpower.create({ data });
            }
          } else {
            // true -> false: Update current record with endDate (keep isAssigned true)
            const updateData: any = {
              isPresent: false,
              endDate: now,
            };
            if (i.category !== undefined || i.categoryId !== undefined) {
              updateData.categoryId = await resolveCategoryId(tx, i.categoryId ?? i.category);
            }
            if (i.skillSet !== undefined || i.skillsetId !== undefined) {
              updateData.skillsetId = await resolveSkillsetId(tx, i.skillsetId ?? i.skillSet);
            }
            if (i.wage !== undefined) updateData.wage = asNonNegativeDecimal(i.wage) as any;
            if (i.foodCharges !== undefined) updateData.foodCharges = asNonNegativeDecimal(i.foodCharges) as any;
            if (i.foodCharges2 !== undefined) updateData.foodCharges2 = asNonNegativeDecimal(i.foodCharges2) as any;
            if (i.pf !== undefined) updateData.pf = !!i.pf;
            if (i.esic !== undefined) updateData.esic = !!i.esic;
            if (i.pt !== undefined) updateData.pt = !!i.pt;
            if (i.mlwf !== undefined) updateData.mlwf = !!i.mlwf;
            if (i.assignedAt !== undefined) updateData.assignedDate = asDate(i.assignedAt);

            await tx.siteManpower.update({ where: { id: existing.id }, data: updateData });
          }
        } else {
          // No isPresent change - just update other fields
          const data: any = {};
          if (i.category !== undefined || i.categoryId !== undefined) {
            data.categoryId = await resolveCategoryId(tx, i.categoryId ?? i.category);
          }
          if (i.skillSet !== undefined || i.skillsetId !== undefined) {
            data.skillsetId = await resolveSkillsetId(tx, i.skillsetId ?? i.skillSet);
          }
          if (i.wage !== undefined) data.wage = asNonNegativeDecimal(i.wage) as any;
          if (i.foodCharges !== undefined) data.foodCharges = asNonNegativeDecimal(i.foodCharges) as any;
          if (i.foodCharges2 !== undefined) data.foodCharges2 = asNonNegativeDecimal(i.foodCharges2) as any;
          if (i.pf !== undefined) data.pf = !!i.pf;
          if (i.esic !== undefined) data.esic = !!i.esic;
          if (i.pt !== undefined) data.pt = !!i.pt;
          if (i.mlwf !== undefined) data.mlwf = !!i.mlwf;
          if (i.assignedAt !== undefined) data.assignedDate = asDate(i.assignedAt);

          if (Object.keys(data).length > 0) {
            await tx.siteManpower.update({ where: { id: existing.id }, data });
          }
        }
        count++;
      }
      return count;
    });

    return Success({ count: updates });
  } catch (e) {
    return ApiError('Failed to update assignments');
  }
}

// DELETE /api/manpower-assignments  { manpowerIds: number[], siteId? }
export async function DELETE(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    const siteId = body?.siteId != null ? Number(body.siteId) : undefined;
    const manpowerIds: number[] = Array.isArray(body?.manpowerIds) ? body.manpowerIds.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)) : [];
    if (manpowerIds.length === 0) return ApiBadRequest('manpowerIds are required');

    const count = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let updated = 0;
      for (const manpowerId of manpowerIds) {
        const where: any = { manpowerId };
        if (siteId != null) where.siteId = siteId;

        // Find all records for this manpower at the site and set endDate before deleting
        const existingRecords = await tx.siteManpower.findMany({ 
          where, 
          select: { id: true, siteId: true, manpowerId: true, endDate: true } 
        });
        if (existingRecords.length === 0) continue;

        // Update endDate on records that don't have it set (keep historical data)
        for (const record of existingRecords) {
          if (!record.endDate) {
            await tx.siteManpower.update({
              where: { id: record.id },
              data: { isAssigned: false, endDate: now, isPresent: false },
            });
          }
        }

        // Note: We intentionally keep all siteManpower records for historical tracking
        await tx.siteManpowerLog.updateMany({
          where: {
            manpowerId,
            siteId: existingRecords[0].siteId,
            unassignedDate: null,
          },
          data: {
            unassignedDate: now,
            unassignedById: auth.user.id,
          },
        });

        await tx.manpower.update({
          where: { id: manpowerId },
          data: { isAssigned: false },
          select: { id: true },
        });

        updated++;
      }
      return updated;
    });

    return Success({ count });
  } catch (e) {
    return ApiError('Failed to unassign manpower');
  }
}
