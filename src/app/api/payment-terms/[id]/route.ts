import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  paymentTerm: z.string().min(1, "Payment term is required").optional(),
  description: z.string().optional().nullable(),
});

// GET /api/payment-terms/[id] - Get single payment term
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid payment term ID", 400);

    const paymentTerm = await prisma.paymentTerm.findUnique({
      where: { id },
      select: { 
        id: true, 
        paymentTerm: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!paymentTerm) return NotFound('Payment term not found');
    return Success(paymentTerm);
  } catch (error) {
    console.error("Get payment term error:", error);
    return Error("Failed to fetch payment term");
  }
}

// PATCH /api/payment-terms/[id] - Update payment term
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid payment term ID", 400);

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return Error("No valid fields to update", 400);
    }

    // Prepare the data for update
    const dataToUpdate: any = {};
    if (updateData.paymentTerm !== undefined) {
      dataToUpdate.paymentTerm = updateData.paymentTerm.trim();
    }
    if (updateData.description !== undefined) {
      dataToUpdate.description = updateData.description?.trim() || null;
    }

    const updated = await prisma.paymentTerm.update({
      where: { id },
      data: dataToUpdate,
      select: { 
        id: true, 
        paymentTerm: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('Payment term not found');
    if (error.code === 'P2002') {
      return Error('Payment term with this name already exists', 409);
    }
    console.error("Update payment term error:", error);
    return Error("Failed to update payment term");
  }
}

// DELETE /api/payment-terms/[id] - Delete payment term
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid payment term ID", 400);

    await prisma.paymentTerm.delete({
      where: { id }
    });

    return Success({ message: "Payment term deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2025') return NotFound('Payment term not found');
    console.error("Delete payment term error:", error);
    return Error("Failed to delete payment term");
  }
}
