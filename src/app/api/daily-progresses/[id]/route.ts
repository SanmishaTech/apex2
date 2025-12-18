import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/daily-progresses/:id
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error("Invalid id", 400);

  try {
    const dp = await prisma.dailyProgress.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        siteId: true,
        boqId: true,
        progressDate: true,
        amount: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true, workName: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        dailyProgressDetails: {
          select: {
            id: true,
            boqItemId: true,
            clientSerialNo: true,
            activityId: true,
            particulars: true,
            doneQty: true,
            amount: true,
            boqItems: {
              select: {
                id: true,
                item: true,
                unitId: true,
                unit: { select: { unitName: true } },
                qty: true,
                rate: true,
                amount: true,
                remainingQty: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
        dailyProgressHindrances: {
          select: {
            id: true,
            from: true,
            to: true,
            hrs: true,
            location: true,
            reason: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!dp) return Error("Daily Progress not found", 404);
    return Success(dp);
  } catch {
    return Error("Failed to fetch Daily Progress");
  }
}

// DELETE /api/daily-progresses/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error("Invalid id", 400);

  try {
    await prisma.dailyProgress.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2025") return Error("Daily Progress not found", 404);
    return Error("Failed to delete Daily Progress");
  }
}
