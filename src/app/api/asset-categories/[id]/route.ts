import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  assetGroupId: z.number().int().positive("Asset group is required").optional(),
  category: z.string().min(1, "Category name is required").optional(),
});

// GET - Individual asset category with relation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const assetCategory = await prisma.assetCategory.findUnique({
      where: { id },
      select: { 
        id: true, 
        assetGroupId: true,
        category: true, 
        createdAt: true, 
        updatedAt: true,
        assetGroup: {
          select: {
            id: true,
            assetGroup: true
          }
        }
      }
    });

    if (!assetCategory) return NotFound('Asset category not found');
    return Success(assetCategory);
  } catch (error) {
    console.error("Get asset category error:", error);
    return Error("Failed to fetch asset category");
  }
}

// PATCH - Update asset category
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    // Verify asset group exists if being updated
    if (updateData.assetGroupId) {
      const assetGroupExists = await prisma.assetGroup.findUnique({
        where: { id: updateData.assetGroupId }
      });
      
      if (!assetGroupExists) {
        return BadRequest("Invalid asset group");
      }
    }

    const updated = await prisma.assetCategory.update({
      where: { id },
      data: updateData,
      select: { 
        id: true, 
        assetGroupId: true,
        category: true, 
        createdAt: true, 
        updatedAt: true,
        assetGroup: {
          select: {
            id: true,
            assetGroup: true
          }
        }
      }
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('Asset category not found');
    if (error.code === 'P2002') {
      return Error('Category already exists for this asset group', 409);
    }
    console.error("Update asset category error:", error);
    return Error("Failed to update asset category");
  }
}

// DELETE - Delete asset category
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) return BadRequest("Invalid ID");

    await prisma.assetCategory.delete({
      where: { id }
    });

    return Success({ message: 'Asset category deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return NotFound('Asset category not found');
    console.error("Delete asset category error:", error);
    return Error("Failed to delete asset category");
  }
}
