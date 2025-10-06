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
        assignedAt: true,
        currentSite: { select: { id: true, site: true, shortName: true } },
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
    const data: any = {};

    if (body.category !== undefined) data.category = (typeof body.category === 'string' && body.category.trim() === '') ? null : (body.category ?? null);
    if (body.skillSet !== undefined) data.skillSet = (typeof body.skillSet === 'string' && body.skillSet.trim() === '') ? null : (body.skillSet ?? null);
    if (body.wage !== undefined) data.wage = asNonNegativeDecimal(body.wage) as any;
    if (body.minWage !== undefined) data.minWage = asNonNegativeDecimal(body.minWage) as any;
    if (body.esic !== undefined) data.esic = asStringDecimal(body.esic) as any;
    if (body.pf !== undefined) data.pf = !!body.pf;
    if (body.pt !== undefined) data.pt = asStringDecimal(body.pt) as any;
    if (body.hra !== undefined) data.hra = asStringDecimal(body.hra) as any;
    if (body.mlwf !== undefined) data.mlwf = asStringDecimal(body.mlwf) as any;
    if (body.assignedAt !== undefined) data.assignedAt = asDate(body.assignedAt);

    if (body.currentSiteId !== undefined) {
      if (body.currentSiteId === null) {
        data.currentSiteId = null;
        data.isAssigned = false;
      } else {
        const siteId = Number(body.currentSiteId);
        if (!Number.isFinite(siteId)) return ApiBadRequest('Invalid currentSiteId');
        data.currentSiteId = siteId;
        data.isAssigned = true;
        if (!data.assignedAt) data.assignedAt = new Date();
      }
    }

    if (Object.keys(data).length === 0) return ApiBadRequest('No fields to update');

    const updated = await prisma.manpower.update({
      where: { id },
      data,
      select: { id: true },
    });

    return Success({ id: updated.id, updated: true });
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
    await prisma.manpower.update({
      where: { id },
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
    });
    return Success({ id, unassigned: true });
  } catch (e) {
    return ApiError('Failed to unassign manpower');
  }
}
