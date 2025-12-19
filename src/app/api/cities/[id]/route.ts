import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  city: z.string().min(1, "City name is required").optional(),
  stateId: z.number().optional().nullable(),
});

// GET /api/cities/[id] - Get single city
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid city ID");

    const city = await prisma.city.findUnique({
      where: { id },
      select: { 
        id: true, 
        city: true, 
        createdAt: true,
        updatedAt: true,
        stateId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        }
      }
    });

    if (!city) return NotFound('City not found');
    return Success(city);
  } catch (error) {
    console.error("Get city error:", error);
    return Error("Failed to fetch city");
  }
}

// PATCH /api/cities/[id] - Update city
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid city ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const updated = await prisma.city.update({
      where: { id },
      data: updateData,
      select: { 
        id: true, 
        city: true, 
        createdAt: true,
        updatedAt: true
      }
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('City not found');
    if (error.code === 'P2002') {
      return Error('City with this combination already exists', 409);
    }
    console.error("Update city error:", error);
    return Error("Failed to update city");
  }
}

// DELETE /api/cities/[id] - Delete city
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid city ID");

    await prisma.city.delete({
      where: { id }
    });

    return Success({ message: "City deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2025') return NotFound('City not found');
    if (error.code === 'P2003') {
      return Error(
        'Cannot delete this city because it is in use by other records. Please remove those links and try again.',
        409
      );
    }
    console.error("Delete city error:", error);
    return Error("Failed to delete city");
  }
}
