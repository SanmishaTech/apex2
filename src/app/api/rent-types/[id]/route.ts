import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  rentType: z.string().min(1, "Rent type is required").optional(),
});

// GET /api/rent-types/[id] - Get single rent type
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid rent type ID");

    const rentType = await prisma.rentType.findUnique({
      where: { id },
      select: {
        id: true,
        rentType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!rentType) return NotFound("Rent type not found");
    return Success(rentType);
  } catch (error) {
    console.error("Get rent type error:", error);
    return Error("Failed to fetch rent type");
  }
}

// PATCH /api/rent-types/[id] - Update rent type
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid rent type ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const updated = await prisma.rentType.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        rentType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Rent type not found");
    if (error.code === "P2002") {
      return Error("Rent type already exists", 409);
    }
    console.error("Update rent type error:", error);
    return Error("Failed to update rent type");
  }
}

// DELETE /api/rent-types/[id] - Delete rent type
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid rent type ID");

    await prisma.rentType.delete({ where: { id } });

    return Success({ message: "Rent type deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Rent type not found");
    console.error("Delete rent type error:", error);
    return Error("Failed to delete rent type");
  }
}
