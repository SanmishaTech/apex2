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
      where.siteManpower = { siteId };
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
          select: {
            siteId: true,
            wage: true,
            minWage: true,
            pf: true,
            esic: true,
            pt: true,
            hra: true,
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
            const sm = row?.siteManpower;
            return {
              ...row,
              // Back-compat keys used by older UI
              currentSiteId: sm?.siteId ?? null,
              assignedAt: sm?.assignedDate ?? null,
              wage: sm?.wage ?? null,
              minWage: sm?.minWage ?? null,
              pf: sm?.pf ?? false,
              esic: sm?.esic ?? false,
              pt: sm?.pt ?? false,
              hra: sm?.hra ?? false,
              mlwf: sm?.mlwf ?? false,
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

// POST /api/manpower-assignments  { siteId, items: [{ manpowerId, category, skillSet, wage, minWage, esic, pf, pt }] }
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

        await tx.siteManpower.create({
          data: {
            siteId,
            manpowerId,
            assignedDate: asDate(i.assignedAt) ?? now,
            assignedById: auth.user.id,
            categoryId,
            skillsetId,
            wage: asNonNegativeDecimal(i.wage) as any,
            minWage: asNonNegativeDecimal(i.minWage) as any,
            pf: !!i.pf,
            esic: !!i.esic,
            pt: !!i.pt,
            hra: !!i.hra,
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
      let count = 0;
      for (const i of items) {
        const manpowerId = Number(i.manpowerId);
        if (!Number.isFinite(manpowerId)) continue;

        const where: any = { manpowerId };
        if (siteId !== undefined) where.siteId = siteId;

        const data: any = {};
        if (i.category !== undefined || i.categoryId !== undefined) {
          data.categoryId = await resolveCategoryId(tx, i.categoryId ?? i.category);
        }
        if (i.skillSet !== undefined || i.skillsetId !== undefined) {
          data.skillsetId = await resolveSkillsetId(tx, i.skillsetId ?? i.skillSet);
        }
        if (i.wage !== undefined) data.wage = asNonNegativeDecimal(i.wage) as any;
        if (i.minWage !== undefined) data.minWage = asNonNegativeDecimal(i.minWage) as any;
        if (i.pf !== undefined) data.pf = !!i.pf;
        if (i.esic !== undefined) data.esic = !!i.esic;
        if (i.pt !== undefined) data.pt = !!i.pt;
        if (i.hra !== undefined) data.hra = !!i.hra;
        if (i.mlwf !== undefined) data.mlwf = !!i.mlwf;
        if (i.assignedAt !== undefined) data.assignedDate = asDate(i.assignedAt);

        await tx.siteManpower.update({ where, data, select: { id: true } });
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

        const existing = await tx.siteManpower.findFirst({ where, select: { siteId: true, manpowerId: true } });
        if (!existing) continue;

        await tx.siteManpower.delete({ where: { manpowerId } });

        await tx.siteManpowerLog.updateMany({
          where: {
            manpowerId,
            siteId: existing.siteId,
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
