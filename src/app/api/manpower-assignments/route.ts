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
      where.currentSiteId = siteId;
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
      model: prisma.manpower,
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
        // assignment fields
        category: true,
        skillSet: true,
        wage: true,
        minWage: true,
        esic: true,
        pf: true,
        pt: true,
        hra: true,
        mlwf: true,
        isAssigned: true,
        currentSiteId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(result);
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
      // Ensure all target manpower are currently unassigned
      const existing = await tx.manpower.findMany({ where: { id: { in: ids } }, select: { id: true, isAssigned: true } });
      const notAllowed = existing.filter((m) => m.isAssigned);
      if (notAllowed.length > 0) {
        throw new Error('Some manpower already assigned. Refresh and try again.');
      }
      // Apply updates
      const now = new Date();
      const updates = await Promise.all(
        items.map((i) =>
          tx.manpower.update({
            where: { id: Number(i.manpowerId) },
            data: {
              currentSiteId: siteId,
              isAssigned: true,
              assignedAt: asDate(i.assignedAt) ?? now,
              category: (typeof i.category === 'string' && i.category.trim() === '') ? null : (i.category ?? null),
              skillSet: (typeof i.skillSet === 'string' && i.skillSet.trim() === '') ? null : (i.skillSet ?? null),
              wage: asNonNegativeDecimal(i.wage) as any,
              minWage: asNonNegativeDecimal(i.minWage) as any,
              esic: asStringDecimal(i.esic) as any,
              pf: i.pf === true,
              pt: asStringDecimal(i.pt) as any,
              hra: asStringDecimal(i.hra) as any,
              mlwf: asStringDecimal(i.mlwf) as any,
            } as any,
            select: { id: true },
          })
        )
      );
      return updates.length;
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
        const id = Number(i.manpowerId);
        if (!Number.isFinite(id)) continue;
        const data: any = {};
        if (i.category !== undefined) data.category = (typeof i.category === 'string' && i.category.trim() === '') ? null : (i.category ?? null);
        if (i.skillSet !== undefined) data.skillSet = (typeof i.skillSet === 'string' && i.skillSet.trim() === '') ? null : (i.skillSet ?? null);
        if (i.wage !== undefined) data.wage = asNonNegativeDecimal(i.wage) as any;
        if (i.minWage !== undefined) data.minWage = asNonNegativeDecimal(i.minWage) as any;
        if (i.esic !== undefined) data.esic = asStringDecimal(i.esic) as any;
        if (i.pf !== undefined) data.pf = !!i.pf;
        if (i.pt !== undefined) data.pt = asStringDecimal(i.pt) as any;
        if (i.hra !== undefined) data.hra = asStringDecimal(i.hra) as any;
        if (i.mlwf !== undefined) data.mlwf = asStringDecimal(i.mlwf) as any;
        if (i.assignedAt !== undefined) data.assignedAt = asDate(i.assignedAt);
        

        const where: any = { id };
        if (siteId !== undefined) where.currentSiteId = siteId;
        await tx.manpower.update({ where, data: data as any, select: { id: true } }).catch((err) => {
          throw err;
        });
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
      const updates = await Promise.all(
        manpowerIds.map((id) =>
          tx.manpower.update({
            where: siteId != null ? { id, currentSiteId: siteId } as any : { id },
            data: {
              isAssigned: false,
              currentSiteId: null,
              assignedAt: null,
              category: null,
              skillSet: null,
              wage: null as any,
              minWage: null as any,
              esic: null as any,
              pf: false,
              pt: null as any,
              hra: null as any,
              mlwf: null as any,
            } as any,
            select: { id: true },
          })
        )
      );
      return updates.length;
    });

    return Success({ count });
  } catch (e) {
    return ApiError('Failed to unassign manpower');
  }
}
