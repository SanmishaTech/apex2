import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { z } from 'zod';

const createSchema = z.object({
  siteId: z.number(),
  categoryId: z.number(),
  skillSetId: z.number(),
  minWage: z.string().or(z.number()).transform(v => Number(v)).refine(v => !Number.isNaN(v), 'minWage must be a number'),
});

// GET /api/minimum-wages?siteId=&categoryId=&skillSetId=&page=1&perPage=10
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
    const search = (searchParams.get('search') || '').trim();
    const sort = (searchParams.get('sort') || 'createdAt');
    const order = (searchParams.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

    const where: any = {};
    const siteIdParam = searchParams.get('siteId');
    if (siteIdParam !== null && siteIdParam !== '') {
      const id = Number(siteIdParam);
      if (!Number.isNaN(id)) where.siteId = id;
    }
    const categoryIdParam = searchParams.get('categoryId');
    if (categoryIdParam !== null && categoryIdParam !== '') {
      const id = Number(categoryIdParam);
      if (!Number.isNaN(id)) where.categoryId = id;
    }
    const skillSetIdParam = searchParams.get('skillSetId');
    if (skillSetIdParam !== null && skillSetIdParam !== '') {
      const id = Number(skillSetIdParam);
      if (!Number.isNaN(id)) where.skillSetId = id;
    }

    // Build where clause (search over related names or numeric wage)
    if (search) {
      const or: any[] = [
        { site: { site: { contains: search } } },
        { category: { categoryName: { contains: search } } },
        { skillSet: { skillsetName: { contains: search } } },
      ];
      const asNum = Number(search);
      if (!Number.isNaN(asNum)) {
        or.push({ minWage: { equals: String(asNum) as any } });
      }
      where.OR = or;
    }

    // Map sort to orderBy (including relations)
    let orderBy: any = { createdAt: 'desc' as const };
    const allowed = new Set(['site', 'category', 'skillSet', 'minWage', 'createdAt', 'updatedAt']);
    if (allowed.has(sort)) {
      switch (sort) {
        case 'site':
          orderBy = { site: { site: order } };
          break;
        case 'category':
          orderBy = { category: { categoryName: order } };
          break;
        case 'skillSet':
          orderBy = { skillSet: { skillsetName: order } };
          break;
        case 'minWage':
          orderBy = { minWage: order };
          break;
        case 'updatedAt':
          orderBy = { updatedAt: order };
          break;
        default:
          orderBy = { createdAt: order };
      }
    }

    const result = await paginate({
      model: prisma.minimumWage as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        siteId: true,
        categoryId: true,
        skillSetId: true,
        minWage: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true, shortName: true } },
        category: { select: { id: true, categoryName: true } },
        skillSet: { select: { id: true, skillsetName: true } },
      },
    });
    return Success(result);
  } catch (e) {
    return Error('Failed to fetch minimum wages');
  }
}

// POST /api/minimum-wages (Upsert: create or update if exists)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const data = await req.json().catch(() => null);
    const parsed = createSchema.parse({
      siteId: Number(data?.siteId),
      categoryId: Number(data?.categoryId),
      skillSetId: Number(data?.skillSetId),
      minWage: data?.minWage,
    });

    const result = await prisma.$transaction(async (tx) => {
      // Upsert: create or update if exists
      const upserted = await tx.minimumWage.upsert({
        where: {
          siteId_categoryId_skillSetId: {
            siteId: parsed.siteId,
            categoryId: parsed.categoryId,
            skillSetId: parsed.skillSetId,
          },
        },
        create: {
          siteId: parsed.siteId,
          categoryId: parsed.categoryId,
          skillSetId: parsed.skillSetId,
          minWage: String(parsed.minWage) as any,
        },
        update: {
          minWage: String(parsed.minWage) as any,
        },
        select: { id: true },
      });

      // Update all assigned manpower with matching site, category, and skillset
      await tx.siteManpower.updateMany({
        where: {
          siteId: parsed.siteId,
          categoryId: parsed.categoryId,
          skillsetId: parsed.skillSetId,
          manpower: { isAssigned: true },
        },
        data: {
          minWage: String(parsed.minWage) as any,
        },
      });

      return { id: upserted.id };
    });

    return Success(result, 201);
  } catch (e: any) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    return Error('Failed to save minimum wage');
  }
}

// PATCH /api/minimum-wages
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const data = await req.json().catch(() => null);
    const id = Number(data?.id);
    if (!id || Number.isNaN(id)) return Error('id is required', 400);

    const patchSchema = z.object({
      siteId: z.number().optional(),
      categoryId: z.number().optional(),
      skillSetId: z.number().optional(),
      minWage: z.string().or(z.number()).optional(),
    });
    const parsed = patchSchema.parse({
      siteId: data?.siteId != null ? Number(data.siteId) : undefined,
      categoryId: data?.categoryId != null ? Number(data.categoryId) : undefined,
      skillSetId: data?.skillSetId != null ? Number(data.skillSetId) : undefined,
      minWage: data?.minWage,
    });

    const updateData: any = {};
    if (parsed.siteId !== undefined) updateData.siteId = parsed.siteId;
    if (parsed.categoryId !== undefined) updateData.categoryId = parsed.categoryId;
    if (parsed.skillSetId !== undefined) updateData.skillSetId = parsed.skillSetId;
    if (parsed.minWage !== undefined) updateData.minWage = String(parsed.minWage);

    const result = await prisma.$transaction(async (tx) => {
      // Update minimum wage
      const updated = await tx.minimumWage.update({ 
        where: { id }, 
        data: updateData, 
        select: { 
          id: true,
          siteId: true,
          categoryId: true,
          skillSetId: true,
          minWage: true,
        } 
      });

      // Update all assigned manpower with matching site, category, and skillset
      await tx.siteManpower.updateMany({
        where: {
          siteId: updated.siteId,
          categoryId: updated.categoryId,
          skillsetId: updated.skillSetId,
          manpower: { isAssigned: true },
        },
        data: {
          minWage: updated.minWage as any,
        },
      });

      return { id: updated.id };
    });

    return Success(result);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Minimum wage not found', 404);
    if (e?.code === 'P2002') return Error('Minimum wage for this combination already exists', 409);
    return Error('Failed to update minimum wage');
  }
}
