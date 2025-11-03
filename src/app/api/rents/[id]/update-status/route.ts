import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["Paid", "Unpaid"]),
  paymentMethod: z.string().min(1).optional(),
  utrNumber: z.string().optional().nullable(),
  chequeNumber: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  bankDetails: z.string().optional().nullable(),
});

// PATCH - Update rent status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    const body = await req.json();
    const parsed = updateStatusSchema.parse(body);

    const existing = await prisma.rent.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NotFound('Rent not found');
    }

    if (existing.status === 'Paid' && parsed.status === 'Unpaid') {
      return BadRequest('Paid rents cannot be marked as unpaid');
    }

    const data: any = {
      status: parsed.status,
    };

    if (parsed.status === "Paid") {
      if (!parsed.paymentMethod) {
        return BadRequest("paymentMethod is required when marking as Paid");
      }
      data.paymentMethod = parsed.paymentMethod;
      data.paymentDate = new Date();
      data.utrNumber = parsed.utrNumber ?? null;
      data.chequeNumber = parsed.chequeNumber ?? null;
      data.chequeDate = parsed.chequeDate ? new Date(parsed.chequeDate) : null;
      data.bankDetails = parsed.bankDetails ?? null;
    } else {
      data.paymentMethod = "Unpaid";
      data.paymentDate = null;
      data.utrNumber = null;
      data.chequeNumber = null;
      data.chequeDate = null;
      data.bankDetails = null;
    }

    const updated = await prisma.rent.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentDate: true,
        utrNumber: true,
        chequeNumber: true,
        chequeDate: true,
        bankDetails: true,
      } as any,
    });

    return Success({ message: `Rent marked as ${parsed.status}`, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if ((error as any).code === 'P2025') {
      return NotFound('Rent not found');
    }
    console.error("Update rent status error:", error);
    return Error("Failed to update rent status");
  }
}