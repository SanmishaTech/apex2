import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// DELETE /api/inward-bill-details/[id] - delete a bill detail and update challan totals/status
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid inward bill detail ID");

    const detail = await prisma.inwardBillDetail.findUnique({
      where: { id },
      select: {
        id: true,
        inwardDeliveryChallanId: true,
        paidAmount: true,
      },
    });
    if (!detail) return NotFound("Inward bill detail not found");

    const result = await prisma.$transaction(async (tx) => {
      await tx.inwardBillDetail.delete({ where: { id } });

      const challan = await tx.inwardDeliveryChallan.findUnique({
        where: { id: detail.inwardDeliveryChallanId },
        select: { id: true, billAmount: true, totalPaidAmount: true },
      });
      if (!challan) throw new Error("Parent challan missing");

      const newTotal = Math.max(
        0,
        Number(challan.totalPaidAmount || 0) - Number(detail.paidAmount || 0)
      );
      const billAmount = Number(challan.billAmount || 0);
      const dueAmount = Math.max(0, Number((billAmount - newTotal).toFixed(2)));

      await tx.inwardDeliveryChallan.update({
        where: { id: challan.id },
        data: {
          totalPaidAmount: newTotal,
          dueAmount,
          updatedBy: { connect: { id: (auth as any).user?.id as number } },
        } as any,
      });

      return true;
    });

    return Success({ deleted: true });
  } catch (error: any) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as any).code === "P2025"
    ) {
      return NotFound("Inward bill detail not found");
    }
    console.error("Delete inward bill detail error:", error);
    return ApiError("Failed to delete inward bill detail");
  }
}
