import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  zoneName: z.string().min(1, "Zone name is required").optional(),
});

// GET /api/zones/[id] - Get single zone
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return ApiError("Invalid zone ID", 400);

    const zone = await prisma.zone.findUnique({
      where: { id },
      select: {
        id: true,
        zoneName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!zone) return NotFound("Zone not found");
    return Success(zone);
  } catch (error) {
    console.error("Get zone error:", error);
    return ApiError("Failed to fetch zone");
  }
}

// PATCH /api/zones/[id] - Update zone
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return ApiError("Invalid zone ID", 400);

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return ApiError("No valid fields to update", 400);
    }

    const updated = await prisma.zone.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        zoneName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Zone not found");
    if (error.code === "P2002") {
      return ApiError("Zone with this name already exists", 409);
    }
    console.error("Update zone error:", error);
    return ApiError("Failed to update zone");
  }
}

// DELETE /api/zones/[id] - Delete zone
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return ApiError("Invalid zone ID", 400);

    await prisma.zone.delete({ where: { id } });

    return Success({ message: "Zone deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Zone not found");
    if (error.code === "P2003") {
      return ApiError(
        "Cannot delete this zone because it is in use by other records. Please remove those links and try again.",
        409
      );
    }
    console.error("Delete zone error:", error);
    return ApiError("Failed to delete zone");
  }
}
