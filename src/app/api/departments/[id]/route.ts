import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  department: z.string().min(1, "Department name is required").optional(),
});

// GET /api/departments/[id] - Get single department
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid department ID");

    const dept = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dept) return NotFound("Department not found");
    return Success(dept);
  } catch (error) {
    console.error("Get department error:", error);
    return Error("Failed to fetch department");
  }
}

// PATCH /api/departments/[id] - Update department
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid department ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const updated = await prisma.department.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Department not found");
    if (error.code === "P2002") {
      return Error("Department already exists", 409);
    }
    console.error("Update department error:", error);
    return Error("Failed to update department");
  }
}

// DELETE /api/departments/[id] - Delete department
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid department ID");

    await prisma.department.delete({ where: { id } });

    return Success({ message: "Department deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Department not found");
    console.error("Delete department error:", error);
    return Error("Failed to delete department");
  }
}
