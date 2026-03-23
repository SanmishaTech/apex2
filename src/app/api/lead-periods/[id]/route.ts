import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { Prisma } from "@prisma/client";

// GET /api/lead-periods/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.VIEW_LEAD_PERIODS]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (isNaN(id)) return Error("Invalid ID", 400);

  const lp = await prisma.leadPeriod.findUnique({
    where: { id },
    include: {
      site: { select: { id: true, site: true } },
      leadPeriodDetails: {
        include: {
          item: { select: { id: true, item: true, itemCode: true } },
        },
      },
    },
  });

  if (!lp) return Error("Record not found", 404);
  return Success(lp);
}

// PATCH /api/lead-periods/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.EDIT_LEAD_PERIODS]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (isNaN(id)) return Error("Invalid ID", 400);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Error("Invalid JSON body", 400);
  }

  const { siteId, items } = body as { siteId: number; items: { itemId: number; period: number }[] };
  if (!siteId) return Error("Site is required", 400);
  if (!items || !Array.isArray(items) || items.length === 0) return Error("Items are required", 400);

  try {
    const userId = auth.user.id;

    const existing = await prisma.leadPeriod.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return Error("Record not found", 404);

    const siteIdNum = Number(siteId);
    const clash = await prisma.leadPeriod.findFirst({
      where: { siteId: siteIdNum, id: { not: id } },
      select: { id: true },
    });
    if (clash) return Error("Lead period for this site already exist", 400);

    const incomingItemIds = items.map((i) => Number(i.itemId));

    const updated = await prisma.$transaction(async (tx) => {
      const lp = await tx.leadPeriod.update({
        where: { id },
        data: {
          siteId: siteIdNum,
          updatedById: userId,
        },
      });

      await tx.leadPeriodDetail.deleteMany({
        where: {
          leadPeriodId: id,
          itemId: { notIn: incomingItemIds },
        },
      });

      for (const item of items) {
        await tx.leadPeriodDetail.upsert({
          where: {
            leadPeriodId_itemId: {
              leadPeriodId: id,
              itemId: Number(item.itemId),
            },
          },
          update: {
            period: Number(item.period),
          },
          create: {
            leadPeriodId: id,
            itemId: Number(item.itemId),
            period: Number(item.period),
          },
        });
      }

      return lp;
    });

    return Success(updated);
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Error("Lead period for this site already exist", 400);
    }
    console.error("Lead Period Update Error:", e);
    return Error("Failed to update lead periods");
  }
}

// DELETE /api/lead-periods/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.DELETE_LEAD_PERIODS]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (isNaN(id)) return Error("Invalid ID", 400);

  try {
    await prisma.$transaction(async (tx) => {
      // Delete details first
      await tx.leadPeriodDetail.deleteMany({ where: { leadPeriodId: id } });
      // Then parent
      await tx.leadPeriod.delete({ where: { id } });
    });
    return Success({ message: "Deleted successfully" });
  } catch (e: any) {
    if (e.code === "P2025") return Error("Record not found", 404);
    console.error("Delete Error:", e);
    return Error("Failed to delete lead period");
  }
}
