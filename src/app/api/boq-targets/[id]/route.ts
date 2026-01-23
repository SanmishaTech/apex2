import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/boq-targets/[id] - Get single BOQ target
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const boqTarget = await prisma.boqTarget.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        boqId: true,
        boq: { select: { id: true, boqNo: true } },
        month: true,
        week: true,
        fromTargetDate: true,
        toTargetDate: true,
        createdAt: true,
        updatedAt: true,
        boqTargetDetails: {
          select: {
            id: true,
            boqTargetId: true,
            BoqItemId: true,
            dailyTargetQty: true,
          },
          orderBy: { BoqItemId: "asc" },
        },
      },
    });

    if (!boqTarget) return Error('BOQ Target not found', 404);
    return Success(boqTarget);
  } catch (err) {
    console.error('Error fetching BOQ target:', err);
    return Error('Failed to fetch BOQ target', 500);
  }
}

// DELETE /api/boq-targets/[id] - Delete BOQ target
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    // Check if BOQ target exists
    const existing = await prisma.boqTarget.findUnique({ where: { id } });
    if (!existing) return Error('BOQ Target not found', 404);

    await prisma.$transaction(async (tx) => {
      await tx.boqTargetDetail.deleteMany({ where: { boqTargetId: id } });
      await tx.boqTarget.delete({ where: { id } });
    });
    return Success({ message: 'BOQ Target deleted successfully' });
  } catch (err) {
    console.error('Error deleting BOQ target:', err);
    return Error('Failed to delete BOQ target', 500);
  }
}
