import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  assetGroupId: z.number().int().positive().optional(),
  assetCategoryId: z.number().int().positive().optional(),
  assetName: z.string().min(1).optional(),
  make: z.string().optional(),
  description: z.string().optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  invoiceNo: z.string().optional(),
  supplier: z.string().optional(),
  invoiceCopyUrl: z.string().optional(),
  nextMaintenanceDate: z.string().datetime().optional().nullable(),
  status: z.string().optional(),
  useStatus: z.string().optional(),
});

// GET - Get individual asset
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const assetId = parseInt(id);
    if (isNaN(assetId)) return BadRequest("Invalid asset ID");

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        make: true,
        description: true,
        status: true,
        useStatus: true,
        purchaseDate: true,
        nextMaintenanceDate: true,
        supplier: true,
        invoiceNo: true,
        invoiceCopyUrl: true,
        assetGroupId: true,
        assetCategoryId: true,
        assetGroup: {
          select: {
            id: true,
            assetGroup: true,
          }
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          }
        },
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!asset) return NotFound('Asset not found');

    return Success(asset);
  } catch (error) {
    console.error("Get asset error:", error);
    return Error("Failed to fetch asset");
  }
}

// PATCH - Update asset
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const assetId = parseInt(id);
    if (isNaN(assetId)) return BadRequest("Invalid asset ID");

    const body = await req.json();
    const validatedData = updateSchema.parse(body);

    // Convert datetime strings to Date objects
    const updateData: any = { ...validatedData };
    
    if (validatedData.purchaseDate) {
      updateData.purchaseDate = new Date(validatedData.purchaseDate);
    }
    if (validatedData.nextMaintenanceDate) {
      updateData.nextMaintenanceDate = new Date(validatedData.nextMaintenanceDate);
    }

    // If updating asset group or category, verify they exist and are compatible
    if (validatedData.assetGroupId || validatedData.assetCategoryId) {
      // Get current asset to check relations
      const currentAsset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { assetGroupId: true, assetCategoryId: true }
      });
      
      if (!currentAsset) return NotFound('Asset not found');

      const finalAssetGroupId = validatedData.assetGroupId || currentAsset.assetGroupId;
      const finalAssetCategoryId = validatedData.assetCategoryId || currentAsset.assetCategoryId;

      // Verify asset group exists
      if (validatedData.assetGroupId) {
        const assetGroup = await prisma.assetGroup.findUnique({
          where: { id: validatedData.assetGroupId }
        });
        if (!assetGroup) {
          return BadRequest("Asset group not found");
        }
      }

      // Verify asset category exists and belongs to the asset group
      if (validatedData.assetCategoryId) {
        const assetCategory = await prisma.assetCategory.findUnique({
          where: { id: validatedData.assetCategoryId }
        });
        if (!assetCategory) {
          return BadRequest("Asset category not found");
        }
        if (assetCategory.assetGroupId !== finalAssetGroupId) {
          return BadRequest("Asset category does not belong to the selected asset group");
        }
      }
    }

    const updated = await prisma.asset.update({
      where: { id: assetId },
      data: updateData,
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        make: true,
        description: true,
        status: true,
        useStatus: true,
        purchaseDate: true,
        nextMaintenanceDate: true,
        supplier: true,
        invoiceNo: true,
        invoiceCopyUrl: true,
        assetGroupId: true,
        assetCategoryId: true,
        assetGroup: {
          select: {
            id: true,
            assetGroup: true,
          }
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          }
        },
        createdAt: true,
        updatedAt: true,
      }
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('Asset not found');
    console.error("Update asset error:", error);
    return Error("Failed to update asset");
  }
}

// DELETE - Delete asset
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id } = await params;
    const assetId = parseInt(id);
    if (isNaN(assetId)) return BadRequest("Invalid asset ID");

    await prisma.asset.delete({
      where: { id: assetId }
    });

    return Success({ message: 'Asset deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') return NotFound('Asset not found');
    console.error("Delete asset error:", error);
    return Error("Failed to delete asset");
  }
}
