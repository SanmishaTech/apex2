import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  state: z.string().min(1, "State name is required").optional(),
});

// GET /api/states/[id] - Get single state
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid state ID", 400);

    const state = await prisma.state.findUnique({
      where: { id },
      select: { 
        id: true, 
        state: true, 
        createdAt: true,
        updatedAt: true
      }
    });

    if (!state) return NotFound('State not found');
    return Success(state);
  } catch (error) {
    console.error("Get state error:", error);
    return Error("Failed to fetch state");
  }
}

// PATCH /api/states/[id] - Update state
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid state ID", 400);

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return Error("No valid fields to update", 400);
    }

    const updated = await prisma.state.update({
      where: { id },
      data: updateData,
      select: { 
        id: true, 
        state: true, 
        createdAt: true,
        updatedAt: true
      }
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('State not found');
    if (error.code === 'P2002') {
      return Error('State with this name already exists', 409);
    }
    console.error("Update state error:", error);
    return Error("Failed to update state");
  }
}

// DELETE /api/states/[id] - Delete state
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return Error("Invalid state ID", 400);

    await prisma.state.delete({
      where: { id }
    });

    return Success({ message: "State deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2025') return NotFound('State not found');
    if (error.code === 'P2003') {
      return Error(
        'Cannot delete this state because it is in use by other records. Please remove those links and try again.',
        409
      );
    }
    console.error("Delete state error:", error);
    return Error("Failed to delete state");
  }
}
