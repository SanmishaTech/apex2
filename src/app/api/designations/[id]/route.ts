import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  designationName: z.string().min(1, "Designation name is required").optional(),
});

// GET /api/designations/[id] - Get single designation
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return ApiError("Invalid designation ID", 400);

    const designation = await prisma.designation.findUnique({
      where: { id },
      select: {
        id: true,
        designationName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!designation) return NotFound("Designation not found");
    return Success(designation);
  } catch (error) {
    console.error("Get designation error:", error);
    return ApiError("Failed to fetch designation");
  }
}

// PATCH /api/designations/[id] - Update designation
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return ApiError("Invalid designation ID", 400);

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return ApiError("No valid fields to update", 400);
    }

    const updated = await prisma.designation.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        designationName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Designation not found");
    if (error.code === "P2002") {
      return ApiError("Designation with this name already exists", 409);
    }
    console.error("Update designation error:", error);
    return ApiError("Failed to update designation");
  }
}

// DELETE /api/designations/[id] - Delete designation
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return ApiError("Invalid designation ID", 400);

    await prisma.designation.delete({ where: { id } });

    return Success({ message: "Designation deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Designation not found");
    if (error.code === "P2003") {
      return ApiError(
        "Cannot delete this designation because it is in use by other records. Please remove those links and try again.",
        409
      );
    }
    console.error("Delete designation error:", error);
    return ApiError("Failed to delete designation");
  }
}
