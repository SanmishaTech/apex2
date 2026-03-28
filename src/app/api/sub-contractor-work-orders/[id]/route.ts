import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS, ROLES } from "@/config/roles";
import { z } from "zod";

const workOrderItemSchema = z.object({
  id: z.number().optional(),
  boqItemId: z.coerce.number().optional().nullable(),
  item: z.string().optional().nullable(),
  sacCode: z.string().nullable().optional(),
  unitId: z.coerce.number().min(1, "Unit is required"),
  qty: z.coerce.number().min(0.0001),
  rate: z.coerce.number().min(0),
  cgst: z.coerce.number().default(0),
  sgst: z.coerce.number().default(0),
  igst: z.coerce.number().default(0),
  cgstAmt: z.coerce.number(),
  sgstAmt: z.coerce.number(),
  igstAmt: z.coerce.number(),
  amount: z.coerce.number(),
  particulars: z.string().nullable().optional(),
});

const updateSchema = z.object({
  workOrderDate: z.string().transform((val) => new Date(val)).optional(),
  typeOfWorkOrder: z.string().optional(),
  quotationNo: z.string().optional().nullable(),
  quotationDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  paymentTermsInDays: z.coerce.number().optional().nullable(),
  deliveryDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  note: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  deliverySchedule: z.string().optional().nullable(),
  amountInWords: z.string().optional(),
  paymentTermIds: z.array(z.coerce.number()).optional(),
  workOrderItems: z.array(workOrderItemSchema).optional(),
  totalAmount: z.coerce.number().optional(),
  totalCgst: z.coerce.number().optional().nullable(),
  totalSgst: z.coerce.number().optional().nullable(),
  totalIgst: z.coerce.number().optional().nullable(),
  statusAction: z.enum(["approve1", "approve2", "complete", "suspend", "unsuspend"]).optional(),
  remarks: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const swo = await prisma.subContractorWorkOrder.findUnique({
      where: { id },
      include: {
        site: true,
        subContractor: true,
        vendor: true,
        billingAddress: { include: { state: true, city: true } },
        boq: true,
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        approved1By: { select: { id: true, name: true } },
        approved2By: { select: { id: true, name: true } },
        suspendedBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        subContractorWorkOrderDetails: { include: { unit: true } },
        subContractorWorkOrderPaymentTerms: { include: { paymentTerm: true } },
      },
    });

    if (!swo) return NotFound("Work order not found");
    return Success(swo);
  } catch (error) {
    console.error("Get SWO error:", error);
    return ApiError("Failed to fetch sub contractor work order");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.subContractorWorkOrder.findUnique({
        where: { id },
      });
      if (!current) throw new Error("Work order not found");

      const { workOrderItems, paymentTermIds, statusAction, remarks, ...baseData } = updateData;

      const dataToUpdate: any = { ...baseData };
      const now = new Date();

      if (statusAction) {
        const permSet = new Set((auth.user.permissions || []) as string[]);
        if (statusAction === "approve1") {
          if (!permSet.has(PERMISSIONS.APPROVE_SUB_CONTRACTOR_WORK_ORDERS_L1)) throw new Error("No L1 permission");
          dataToUpdate.status = "APPROVED_LEVEL_1";
          dataToUpdate.isApproved1 = true;
          dataToUpdate.approved1ById = auth.user.id;
          dataToUpdate.approved1At = now;
        } else if (statusAction === "approve2") {
          if (!permSet.has(PERMISSIONS.APPROVE_SUB_CONTRACTOR_WORK_ORDERS_L2)) throw new Error("No L2 permission");
          dataToUpdate.status = "APPROVED_LEVEL_2";
          dataToUpdate.isApproved2 = true;
          dataToUpdate.approved2ById = auth.user.id;
          dataToUpdate.approved2At = now;
        } else if (statusAction === "complete") {
          if (!permSet.has(PERMISSIONS.COMPLETE_SUB_CONTRACTOR_WORK_ORDERS)) throw new Error("No complete permission");
          dataToUpdate.status = "COMPLETED";
          dataToUpdate.isCompleted = true;
          dataToUpdate.completedById = auth.user.id;
          dataToUpdate.completedDatetime = now;
        } else if (statusAction === "suspend") {
          if (!permSet.has(PERMISSIONS.SUSPEND_SUB_CONTRACTOR_WORK_ORDERS)) throw new Error("No suspend permission");
          dataToUpdate.status = "SUSPENDED";
          dataToUpdate.isSuspended = true;
          dataToUpdate.suspendedById = auth.user.id;
          dataToUpdate.suspendedDatetime = now;
        } else if (statusAction === "unsuspend") {
          dataToUpdate.isSuspended = false;
          dataToUpdate.status = current.isApproved2 ? "APPROVED_LEVEL_2" : current.isApproved1 ? "APPROVED_LEVEL_1" : "DRAFT";
        }
      }

      dataToUpdate.updatedById = auth.user.id;

      const updated = await tx.subContractorWorkOrder.update({
        where: { id },
        data: dataToUpdate,
      });

      if (paymentTermIds) {
        await tx.subContractorWorkOrderPaymentTerm.deleteMany({ where: { subContractorWorkOrderId: id } });
        await tx.subContractorWorkOrderPaymentTerm.createMany({
          data: paymentTermIds.map((ptId) => ({ subContractorWorkOrderId: id, paymentTermId: ptId })),
        });
      }

      if (workOrderItems) {
        await tx.subContractorWorkOrderDetail.deleteMany({ where: { subContractorWorkOrderId: id } });
        await tx.subContractorWorkOrderDetail.createMany({
          data: workOrderItems.map((item) => ({
            subContractorWorkOrderId: id,
            boqItemId: item.boqItemId,
            item: item.item,
            sacCode: item.sacCode,
            unitId: item.unitId,
            qty: item.qty,
            orderedQty: item.qty,
            approved1Qty: item.qty,
            approved2Qty: item.qty,
            rate: item.rate,
            cgst: item.cgst,
            cgstAmt: item.cgstAmt,
            sgst: item.sgst,
            sgstAmt: item.sgstAmt,
            igst: item.igst,
            igstAmt: item.igstAmt,
            amount: item.amount,
            particulars: item.particulars,
          })),
        });
      }

      return updated;
    });

    return Success(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    console.error("Update SWO error:", error);
    return ApiError(error.message || "Failed to update sub contractor work order");
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const permSet = new Set((auth.user.permissions || []) as string[]);
    if (!permSet.has(PERMISSIONS.DELETE_SUB_CONTRACTOR_WORK_ORDERS)) {
      return BadRequest("Missing permission to delete");
    }

    await prisma.$transaction(async (tx) => {
      await tx.subContractorWorkOrderDetail.deleteMany({ where: { subContractorWorkOrderId: id } });
      await tx.subContractorWorkOrderPaymentTerm.deleteMany({ where: { subContractorWorkOrderId: id } });
      await tx.subContractorWorkOrder.delete({ where: { id } });
    });

    return Success({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete SWO error:", error);
    return ApiError("Failed to delete sub contractor work order");
  }
}
