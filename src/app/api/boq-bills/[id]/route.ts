import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess, guardApiPermissions } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import { z } from "zod";

function toDbDate(input: string): Date {
  const s = String(input || "").trim();
  if (!s) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  const day = d.toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`);
}

const updateSchema = z.object({
  boqId: z.coerce.number().int().min(1).optional(),
  billNumber: z.string().min(1).max(100).optional(),
  billName: z.string().min(1).max(200).optional(),
  billDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: "Invalid bill date" })
    .optional(),
  remarks: z.string().optional().nullable(),
  details: z
    .array(
      z.object({
        id: z.coerce.number().int().positive().optional().nullable(),
        boqItemId: z.coerce.number().int().min(1),
        qty: z.coerce.number().min(0),
      })
    )
    .optional(),
});

const billSelect = {
  id: true,
  boqId: true,
  billNumber: true,
  billName: true,
  billDate: true,
  remarks: true,
  totalBillAmount: true,
  createdAt: true,
  updatedAt: true,
  boq: {
    select: {
      id: true,
      boqNo: true,
      workName: true,
      site: { select: { id: true, site: true } },
    },
  },
  boqBillDetails: {
    select: {
      id: true,
      boqBillId: true,
      boqItemId: true,
      qty: true,
      amount: true,
      boqItem: {
        select: {
          id: true,
          activityId: true,
          clientSrNo: true,
          item: true,
          rate: true,
          unit: { select: { unitName: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  },
} as const;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authRead = await guardApiPermissions(req, [PERMISSIONS.READ_BOQ_BILLS]);
  if (authRead.ok === true) {
    // ok
  } else {
    if ((authRead.response as Response).status !== 403) return authRead.response;
    const authEdit = await guardApiPermissions(req, [PERMISSIONS.EDIT_BOQ_BILLS]);
    if (authEdit.ok === false) return authRead.response;
  }

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    const bill = await prisma.bOQBill.findUnique({
      where: { id },
      select: billSelect,
    });

    if (!bill) return NotFound("BOQ bill not found");

    const totalAmount = (bill.boqBillDetails || []).reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0
    );

    return Success({ ...bill, totalAmount });
  } catch (error) {
    console.error("Get boq-bill error:", error);
    return ApiError("Failed to fetch boq-bill");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const existing = await prisma.bOQBill.findUnique({
      where: { id },
      select: { id: true, boqId: true },
    });
    if (!existing) return NotFound("BOQ bill not found");

    const nextBoqId = parsed.boqId ?? existing.boqId;

    if (
      parsed.boqId !== undefined &&
      parsed.boqId !== existing.boqId &&
      Array.isArray(parsed.details)
    ) {
      return BadRequest("BOQ cannot be changed while updating bill items");
    }

    if (parsed.boqId) {
      const boq = await prisma.boq.findUnique({
        where: { id: nextBoqId },
        select: { id: true },
      });
      if (!boq) return BadRequest("BOQ not found");
    }

    const details = parsed.details;

    const result = await prisma.$transaction(async (tx) => {
      await tx.bOQBill.update({
        where: { id },
        data: {
          ...(parsed.boqId !== undefined ? { boqId: nextBoqId } : {}),
          ...(parsed.billNumber !== undefined
            ? { billNumber: parsed.billNumber.trim() }
            : {}),
          ...(parsed.billName !== undefined
            ? { billName: parsed.billName.trim() }
            : {}),
          ...(parsed.billDate !== undefined
            ? { billDate: toDbDate(parsed.billDate) }
            : {}),
          ...(parsed.remarks !== undefined ? { remarks: parsed.remarks } : {}),
          updatedById: auth.user.id,
        } as any,
        select: { id: true },
      });

      if (Array.isArray(details)) {
        const itemIds = Array.from(
          new Set(details.map((d) => Number(d.boqItemId)))
        ).filter((v) => Number.isFinite(v) && v > 0);

        const boqItems = itemIds.length
          ? await tx.boqItem.findMany({
              where: { id: { in: itemIds }, boqId: nextBoqId },
              select: { id: true, rate: true },
            })
          : [];

        if (itemIds.length && boqItems.length !== itemIds.length) {
          throw new Error("INVALID_BOQ_ITEMS");
        }

        const rateById = new Map<number, number>();
        boqItems.forEach((it) => rateById.set(it.id, Number(it.rate || 0)));

        const existingDetails = await tx.bOQBillDetail.findMany({
          where: { boqBillId: id },
          select: { id: true, boqBillId: true, boqItemId: true },
        });
        const existingById = new Map<number, { id: number; boqBillId: number; boqItemId: number }>();
        const existingByItemId = new Map<number, { id: number; boqBillId: number; boqItemId: number }>();
        existingDetails.forEach((d) => {
          existingById.set(d.id, d);
          existingByItemId.set(d.boqItemId, d);
        });

        for (const d of details) {
          const boqItemId = Number(d.boqItemId);
          const qty = Number(d.qty || 0);
          const rate = Number(rateById.get(boqItemId) || 0);
          const amount = Number((qty * rate).toFixed(2));

          const detailId = d.id != null ? Number(d.id) : null;
          if (detailId && Number.isFinite(detailId)) {
            const ex = existingById.get(detailId);
            if (!ex || ex.boqBillId !== id) {
              throw new Error("INVALID_DETAIL_ID");
            }
            if (ex.boqItemId !== boqItemId) {
              throw new Error("DETAIL_ITEM_MISMATCH");
            }
            await tx.bOQBillDetail.update({
              where: { id: detailId },
              data: {
                qty: qty as any,
                amount: amount as any,
              },
              select: { id: true },
            });
            continue;
          }

          const exByItem = existingByItemId.get(boqItemId);
          if (exByItem) {
            await tx.bOQBillDetail.update({
              where: { id: exByItem.id },
              data: {
                qty: qty as any,
                amount: amount as any,
              },
              select: { id: true },
            });
            continue;
          }

          if (qty !== 0) {
            await tx.bOQBillDetail.create({
              data: {
                boqBillId: id,
                boqItemId,
                qty: qty as any,
                amount: amount as any,
              },
              select: { id: true },
            });
          }
        }
      }

      const agg = await tx.bOQBillDetail.aggregate({
        where: { boqBillId: id },
        _sum: { amount: true },
      });
      const nextTotalBillAmount = Number(
        Number(agg._sum.amount || 0).toFixed(2)
      );
      await tx.bOQBill.update({
        where: { id },
        data: { totalBillAmount: nextTotalBillAmount as any } as any,
        select: { id: true },
      });

      const updated = await tx.bOQBill.findUnique({
        where: { id },
        select: billSelect,
      });

      if (!updated) throw new Error("Bill missing after update");

      const totalAmount = (updated.boqBillDetails || []).reduce(
        (sum, d) => sum + Number(d.amount || 0),
        0
      );

      return { ...updated, totalAmount };
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    if (error?.message === "INVALID_BOQ_ITEMS") {
      return BadRequest("One or more BOQ items are invalid for selected BOQ");
    }
    if (error?.message === "INVALID_DETAIL_ID") {
      return BadRequest("One or more BOQ bill detail IDs are invalid");
    }
    if (error?.message === "DETAIL_ITEM_MISMATCH") {
      return BadRequest("BOQ bill detail id does not match boqItemId");
    }
    if (error?.code === "P2002") return ApiError("Bill number already exists", 409);
    if (error?.code === "P2025") return NotFound("BOQ bill not found");
    console.error("Update boq-bill error:", error);
    return ApiError("Failed to update boq-bill");
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    await prisma.$transaction(async (tx) => {
      await tx.bOQBillDetail.deleteMany({ where: { boqBillId: id } });
      await tx.bOQBill.delete({ where: { id } });
    });

    return Success({ deleted: true });
  } catch (error: any) {
    if (error?.code === "P2025") return NotFound("BOQ bill not found");
    console.error("Delete boq-bill error:", error);
    return ApiError("Failed to delete boq-bill");
  }
}
