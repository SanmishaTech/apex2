import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  assetGroup: z.string().min(1, "Asset group name is required"),
});

// GET - Individual asset group
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const assetGroup = await prisma.assetGroup.findUnique({
      where: { id },
      select: { id: true, assetGroup: true, createdAt: true, updatedAt: true }
    });

    if (!assetGroup) return NotFound('Asset group not found');
    return Success(assetGroup);
  } catch (error) {
    console.error("Get asset group error:", error);
    return Error("Failed to fetch asset group");
  }
}

// PATCH - Update asset group
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    const updated = await prisma.assetGroup.update({
      where: { id },
      data: updateData,
      select: { id: true, assetGroup: true, createdAt: true, updatedAt: true }
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('Asset group not found');
    if (error.code === 'P2002') {
      return Error('Asset group already exists', 409);
    }
    console.error("Update asset group error:", error);
    return Error("Failed to update asset group");
  }
}

// DELETE - Delete asset group
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) return BadRequest("Invalid ID");

    await prisma.assetGroup.delete({
      where: { id }
    });

    return Success({ message: 'Asset group deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return NotFound('Asset group not found');
    console.error("Delete asset group error:", error);
    return Error("Failed to delete asset group");
  }
}
