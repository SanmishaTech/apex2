import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/item-categories - List Item Categories with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "itemCategoryCode") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type ItemCategoryWhere = {
    OR?: { 
      itemCategoryCode?: { contains: string }; 
      itemCategory?: { contains: string }; 
    }[];
  };
  const where: ItemCategoryWhere = {};
  if (search) {
    where.OR = [
      { itemCategoryCode: { contains: search } },
      { itemCategory: { contains: search } },
    ];
  }

  const sortableFields = new Set(["itemCategoryCode", "itemCategory", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { itemCategoryCode: "asc" };

  const result = await paginate({
    model: prisma.itemCategory,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      itemCategoryCode: true,
      itemCategory: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/item-categories - Create new Item Category
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  // Basic validation
  if (typeof b.itemCategoryCode !== 'string' || !b.itemCategoryCode.trim()) {
    return Error('Valid Item Category Code is required', 400);
  }
  if (typeof b.itemCategory !== 'string' || !b.itemCategory.trim()) {
    return Error('Valid Item Category is required', 400);
  }

  try {
    const itemCategory = await prisma.itemCategory.create({
      data: {
        itemCategoryCode: b.itemCategoryCode.trim(),
        itemCategory: b.itemCategory.trim(),
      },
      select: {
        id: true,
        itemCategoryCode: true,
        itemCategory: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(itemCategory);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return Error('Item Category Code already exists', 409);
    }
    console.error('Error creating Item Category:', err);
    return Error('Failed to create Item Category', 500);
  }
}

// PATCH /api/item-categories - Update Item Category
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  if (typeof b.id !== 'number' || b.id <= 0) {
    return Error('Valid id is required', 400);
  }

  // Check if Item Category exists
  const existing = await prisma.itemCategory.findUnique({ where: { id: b.id } });
  if (!existing) return Error('Item Category not found', 404);

  // Prepare update data
  const updateData: any = {};

  if (b.itemCategoryCode !== undefined) {
    if (typeof b.itemCategoryCode !== 'string' || !b.itemCategoryCode.trim()) {
      return Error('Valid Item Category Code is required', 400);
    }
    updateData.itemCategoryCode = b.itemCategoryCode.trim();
  }

  if (b.itemCategory !== undefined) {
    if (typeof b.itemCategory !== 'string' || !b.itemCategory.trim()) {
      return Error('Valid Item Category is required', 400);
    }
    updateData.itemCategory = b.itemCategory.trim();
  }

  try {
    const itemCategory = await prisma.itemCategory.update({
      where: { id: b.id },
      data: updateData,
      select: {
        id: true,
        itemCategoryCode: true,
        itemCategory: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(itemCategory);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return Error('Item Category Code already exists', 409);
    }
    console.error('Error updating Item Category:', err);
    return Error('Failed to update Item Category', 500);
  }
}
