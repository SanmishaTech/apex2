import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  workOrderId: z.coerce.number().min(1).optional(),
  billNo: z.string().min(1).optional(),
  billDate: z.string().transform((v) => new Date(v)).optional(),
  billAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  dueAmount: z.coerce.number().min(0).optional(),
  dueDate: z.string().transform((v) => new Date(v)).optional(),
  paymentDate: z.string().transform((v) => new Date(v)).optional(),
  paymentMode: z.string().optional(),
  chequeNo: z.string().nullable().optional(),
  chequeDate: z
    .string()
    .nullable()
    .transform((v) => (v ? new Date(v) : null))
    .optional(),
  utrNo: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  deductionTax: z.coerce.number().min(0).optional(),
  status: z.enum(["PAID", "UNPAID", "PARTIALLY_PAID"]).optional(),
});

// Utility: common select for a bill
const billSelect = {
  id: true,
  workOrderId: true,
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
  deductionTax: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  workOrder: { select: { id: true, workOrderNo: true } },
} as const;

// GET /api/work-order-bills/[id]
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    const bill = await prisma.workOrderBill.findUnique({
      where: { id },
      select: billSelect,
    });

    if (!bill) return NotFound("Work order bill not found");
    return Success(bill);
  } catch (error) {
    console.error("Get work-order-bill error:", error);
    return ApiError("Failed to fetch work-order-bill");
  }
}

// PATCH /api/work-order-bills/[id]
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    const body = await req.json();
    const data = updateSchema.parse(body);
    if (Object.keys(data).length === 0) return BadRequest("No valid fields to update");

    const updated = await prisma.workOrderBill.update({
      where: { id },
      data: {
        ...data,
      },
      select: billSelect,
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Work order bill not found");
    if (error.code === "P2003") return ApiError("Invalid work order reference", 409);
    console.error("Update work-order-bill error:", error);
    return ApiError("Failed to update work-order-bill");
  }
}

// DELETE /api/work-order-bills/[id]
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid bill ID");

    await prisma.workOrderBill.delete({ where: { id } });
    return Success({ message: "Work order bill deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Work order bill not found");
    console.error("Delete work-order-bill error:", error);
    return ApiError("Failed to delete work-order-bill");
  }
}
