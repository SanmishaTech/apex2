import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/item-categories/[id] - Get single Item Category
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const itemCategory = await prisma.itemCategory.findUnique({
      where: { id },
      select: {
        id: true,
        itemCategoryCode: true,
        itemCategory: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!itemCategory) return Error('Item Category not found', 404);
    return Success(itemCategory);
  } catch (err) {
    console.error('Error fetching Item Category:', err);
    return Error('Failed to fetch Item Category', 500);
  }
}

// DELETE /api/item-categories/[id] - Delete Item Category
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    // Check if Item Category exists
    const existing = await prisma.itemCategory.findUnique({ where: { id } });
    if (!existing) return Error('Item Category not found', 404);

    await prisma.itemCategory.delete({ where: { id } });
    return Success({ message: 'Item Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting Item Category:', err);
    return Error('Failed to delete Item Category', 500);
  }
}
