import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  assetGroupId: z.number().int().positive("Asset group is required"),
  category: z.string().min(1, "Category name is required"),
});

// GET - List with pagination & search, including asset group relation
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const assetGroupId = searchParams.get("assetGroupId");

    const where: any = {};
    
    // Filter by asset group if provided
    if (assetGroupId && !isNaN(parseInt(assetGroupId))) {
      where.assetGroupId = parseInt(assetGroupId);
    }
    
    // Search functionality
    if (search) {
      where.OR = [
        { category: { contains: search } },
        { assetGroup: { assetGroup: { contains: search } } },
      ];
    }

    const result = await paginate({
      model: prisma.assetCategory,
      where,
      orderBy: { category: "asc" },
      page,
      perPage,
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

    return Success(result);
  } catch (error) {
    console.error("Get asset categories error:", error);
    return Error("Failed to fetch asset categories");
  }
}

// POST - Create with validation
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { assetGroupId, category } = createSchema.parse(body);
    
    // Verify asset group exists
    const assetGroupExists = await prisma.assetGroup.findUnique({
      where: { id: assetGroupId }
    });
    
    if (!assetGroupExists) {
      return BadRequest("Invalid asset group");
    }
    
    const created = await prisma.assetCategory.create({
      data: { assetGroupId, category },
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
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('Category already exists for this asset group', 409);
    }
    console.error("Create asset category error:", error);
    return Error("Failed to create asset category");
  }
}
