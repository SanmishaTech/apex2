import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// Function to generate unique item code
async function generateItemCode(): Promise<string> {
  const lastItem = await prisma.item.findFirst({
    orderBy: { id: 'desc' },
    select: { itemCode: true }
  });

  let nextNumber = 1;
  if (lastItem && lastItem.itemCode) {
    const match = lastItem.itemCode.match(/ITM-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  return `ITM-${nextNumber.toString().padStart(5, '0')}`;
}

// GET /api/items - List Items with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "itemCode") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type ItemWhere = {
    OR?: { 
      itemCode?: { contains: string }; 
      item?: { contains: string };
      hsnCode?: { contains: string };
    }[];
  };
  const where: ItemWhere = {};
  if (search) {
    where.OR = [
      { itemCode: { contains: search } },
      { item: { contains: search } },
      { hsnCode: { contains: search } },
    ];
  }

  const sortableFields = new Set(["itemCode", "item", "gstRate", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { itemCode: "asc" };

  const result = await paginate({
    model: prisma.item,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      itemCode: true,
      hsnCode: true,
      item: true,
      itemCategory: {
        select: {
          itemCategoryCode: true,
          itemCategory: true,
        }
      },
      unit: {
        select: {
          unitName: true,
        }
      },
      gstRate: true,
      asset: true,
      discontinue: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/items - Create new Item
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  // Basic validation
  if (typeof b.item !== 'string' || !b.item.trim()) {
    return Error('Valid Item name is required', 400);
  }

  // Generate item code
  const itemCode = await generateItemCode();

  try {
    const item = await prisma.item.create({
      data: {
        itemCode,
        hsnCode: typeof b.hsnCode === 'string' ? b.hsnCode.trim() || null : null,
        item: b.item.trim(),
        itemCategoryId: typeof b.itemCategoryId === 'number' ? b.itemCategoryId : null,
        unitId: typeof b.unitId === 'number' ? b.unitId : null,
        gstRate: typeof b.gstRate === 'number' ? b.gstRate : null,
        asset: typeof b.asset === 'boolean' ? b.asset : false,
        discontinue: typeof b.discontinue === 'boolean' ? b.discontinue : false,
        description: typeof b.description === 'string' ? b.description.trim() || null : null,
      },
      select: {
        id: true,
        itemCode: true,
        hsnCode: true,
        item: true,
        itemCategoryId: true,
        unitId: true,
        gstRate: true,
        asset: true,
        discontinue: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(item);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return Error('Item code already exists', 409);
    }
    console.error('Error creating Item:', err);
    return Error('Failed to create Item', 500);
  }
}

// PATCH /api/items - Update Item
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  if (typeof b.id !== 'number' || b.id <= 0) {
    return Error('Valid id is required', 400);
  }

  // Check if Item exists
  const existing = await prisma.item.findUnique({ where: { id: b.id } });
  if (!existing) return Error('Item not found', 404);

  // Prepare update data
  const updateData: any = {};

  if (b.hsnCode !== undefined) {
    updateData.hsnCode = typeof b.hsnCode === 'string' ? b.hsnCode.trim() || null : null;
  }

  if (b.item !== undefined) {
    if (typeof b.item !== 'string' || !b.item.trim()) {
      return Error('Valid Item name is required', 400);
    }
    updateData.item = b.item.trim();
  }

  if (b.itemCategoryId !== undefined) {
    updateData.itemCategoryId = typeof b.itemCategoryId === 'number' ? b.itemCategoryId : null;
  }

  if (b.unitId !== undefined) {
    updateData.unitId = typeof b.unitId === 'number' ? b.unitId : null;
  }

  if (b.gstRate !== undefined) {
    updateData.gstRate = typeof b.gstRate === 'number' ? b.gstRate : null;
  }

  if (b.asset !== undefined) {
    updateData.asset = typeof b.asset === 'boolean' ? b.asset : false;
  }

  if (b.discontinue !== undefined) {
    updateData.discontinue = typeof b.discontinue === 'boolean' ? b.discontinue : false;
  }

  if (b.description !== undefined) {
    updateData.description = typeof b.description === 'string' ? b.description.trim() || null : null;
  }

  try {
    const item = await prisma.item.update({
      where: { id: b.id },
      data: updateData,
      select: {
        id: true,
        itemCode: true,
        hsnCode: true,
        item: true,
        itemCategoryId: true,
        unitId: true,
        gstRate: true,
        asset: true,
        discontinue: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(item);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return Error('Item code already exists', 409);
    }
    console.error('Error updating Item:', err);
    return Error('Failed to update Item', 500);
  }
}
