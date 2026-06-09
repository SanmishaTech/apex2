import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const data = await prisma.manpowerFoodCharges.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        monthYear: true,
        createdAt: true,
        updatedAt: true,
        manpowerFoodChargesDetails: {
          select: {
            id: true,
            manpowerFoodChargesId: true,
            manpowerId: true,
            manpower: { select: { id: true, firstName: true, lastName: true } },
            foodCharges1: true,
            foodCharges2: true,
          },
          orderBy: { manpowerId: "asc" },
        },
      } as any,
    } as any);

    if (!data) return Error('Manpower Food Charges not found', 404);
    
    // Deep serialize to handle Prisma Decimal objects to prevent Next.js Response conversion errors
    const serializedData = JSON.parse(JSON.stringify(data));
    return Success(serializedData);
  } catch (err) {
    console.error('Error fetching Manpower Food Charges:', err);
    return Error('Failed to fetch Manpower Food Charges', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const existing = await prisma.manpowerFoodCharges.findUnique({ where: { id } });
    if (!existing) return Error('Manpower Food Charges not found', 404);

    await prisma.$transaction(async (tx) => {
      await tx.manpowerFoodChargesDetail.deleteMany({ where: { manpowerFoodChargesId: id } });
      await tx.manpowerFoodCharges.delete({ where: { id } });
    });
    return Success({ message: 'Manpower Food Charges deleted successfully' });
  } catch (err) {
    console.error('Error deleting Manpower Food Charges:', err);
    return Error('Failed to delete Manpower Food Charges', 500);
  }
}
