import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiPermissions } from "@/lib/access-guard";
import { z } from "zod";
import { PERMISSIONS } from "@/config/roles";

const updateSchema = z.object({
  subContractorWorkOrderId: z.coerce.number().min(1).optional(),
  billNo: z.string().min(1).optional(),
  billDate: z.string().transform((v) => new Date(v)).optional(),
  billAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  dueAmount: z.coerce.number().optional(),
  dueDate: z.string().transform((v) => new Date(v)).optional(),
  paymentDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  paymentMode: z.string().optional(),
  chequeNo: z.string().nullable().optional(),
  chequeDate: z
    .string()
    .nullable()
    .transform((v) => (v ? new Date(v) : null))
    .optional(),
  utrNo: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  rtgsDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  neftDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  transactionNo: z.string().nullable().optional(),
  transactionDate: z.string().nullable().transform((v) => (v ? new Date(v) : null)).optional(),
  deductionTax: z.coerce.number().min(0).optional(),
  status: z.enum(["PAID", "UNPAID", "PARTIALLY_PAID"]).optional(),
});

// Utility: common select for a bill
const billSelect = {
  id: true,
  subContractorWorkOrderId: true,
  billNo: true,
  billDate: true,
  billAmount: true,
  paidAmount: true,
  dueAmount: true,
  dueDate: true,
  paymentDate: true,
  paymentMode: true,
  chequeNo: true,
  chequeDate: true,
  utrNo: true,
  bankName: true,
  rtgsDate: true,
  neftDate: true,
  transactionNo: true,
  transactionDate: true,
  deductionTax: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  subContractorWorkOrder: { select: { id: true, workOrderNo: true } },
} as const;

// GET /api/sub-contractor-work-order-bills/[id]
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.READ_SUB_CONTRACTOR_WORK_ORDER_BILLS]);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    const bill = await prisma.subContractorWorkOrderBill.findUnique({
      where: { id },
      select: billSelect,
    });

    if (!bill) return NotFound("Sub contractor work order bill not found");
    return Success(bill);
  } catch (error) {
    console.error("Get sub-contractor-work-order-bill error:", error);
    return ApiError("Failed to fetch sub-contractor-work-order-bill");
  }
}

// PATCH /api/sub-contractor-work-order-bills/[id]
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.EDIT_SUB_CONTRACTOR_WORK_ORDER_BILLS]);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    const body = await req.json();
    const data = updateSchema.parse(body);
    if (Object.keys(data).length === 0) return BadRequest("No valid fields to update");

    const updated = await prisma.subContractorWorkOrderBill.update({
      where: { id },
      // cast to any to avoid strict Prisma TypeScript mismatches from optional fields
      data: data as any,
      select: billSelect,
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Sub contractor work order bill not found");
    if (error.code === "P2003") return ApiError("Invalid sub-contractor work order reference", 409);
    console.error("Update sub-contractor-work-order-bill error:", error);
    return ApiError("Failed to update sub-contractor-work-order-bill");
  }
}

// DELETE /api/sub-contractor-work-order-bills/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiPermissions(req, [PERMISSIONS.DELETE_SUB_CONTRACTOR_WORK_ORDER_BILLS]);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    await prisma.subContractorWorkOrderBill.delete({ where: { id } });
    return Success({ message: "Sub contractor work order bill deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Sub contractor work order bill not found");
    console.error("Delete sub-contractor-work-order-bill error:", error);
    return ApiError("Failed to delete sub-contractor-work-order-bill");
  }
}
