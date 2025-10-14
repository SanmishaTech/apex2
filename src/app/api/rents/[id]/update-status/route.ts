import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["Paid", "Unpaid"]),
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
    const { status } = updateStatusSchema.parse(body);

    const updated = await prisma.rent.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
      }
    });

    return Success({ message: `Rent marked as ${status}`, data: updated });
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