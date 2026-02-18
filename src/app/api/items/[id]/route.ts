import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/items/[id] - Get single Item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const item = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        itemCode: true,
        hsnCode: true,
        item: true,
        itemCategoryId: true,
        unitId: true,
        gstRate: true,
        asset: true,
        isExpiryDate: true,
        discontinue: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!item) return Error('Item not found', 404);
    return Success(item);
  } catch (err) {
    console.error('Error fetching Item:', err);
    return Error('Failed to fetch Item', 500);
  }
}

// DELETE /api/items/[id] - Delete Item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    // Check if Item exists
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) return Error('Item not found', 404);

    await prisma.item.delete({ where: { id } });
    return Success({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting Item:', err);
    return Error('Failed to delete Item', 500);
  }
}
