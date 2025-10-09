import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  assetGroupId: z.number().int().positive(),
  assetCategoryId: z.number().int().positive(),
  assetName: z.string().min(1),
  make: z.string().optional(),
  description: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  invoiceNo: z.string().optional(),
  supplier: z.string().optional(),
  invoiceCopyUrl: z.string().optional(),
  nextMaintenanceDate: z.string().datetime().optional(),
  status: z.string().default("Working"),
  useStatus: z.string().default("In Use"),
});

// GET - List assets with pagination & search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const assetGroupId = searchParams.get("assetGroupId");
    const assetCategoryId = searchParams.get("assetCategoryId");
    const transferStatus = searchParams.get("transferStatus");
    const currentSiteId = searchParams.get("currentSiteId");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { assetNo: { contains: search } },
        { assetName: { contains: search } },
        { make: { contains: search } },
        { supplier: { contains: search } },
        { invoiceNo: { contains: search } },
        { assetGroup: { assetGroupName: { contains: search } } },
        { assetCategory: { category: { contains: search } } },
      ];
    }
    if (assetGroupId) {
      where.assetGroupId = parseInt(assetGroupId);
    }
    if (assetCategoryId) {
      where.assetCategoryId = parseInt(assetCategoryId);
    }
    if (transferStatus) {
      where.transferStatus = transferStatus;
    }
    if (currentSiteId) {
      where.currentSiteId = parseInt(currentSiteId);
    }

    // Build orderBy object
    const orderBy: any = {};
    orderBy[sort] = order;

    const result = await paginate({
      model: prisma.asset as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        make: true,
        status: true,
        useStatus: true,
        purchaseDate: true,
        nextMaintenanceDate: true,
        supplier: true,
        invoiceNo: true,
        assetGroup: {
          select: {
            id: true,
            assetGroupName: true,
          }
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          }
        },
        transferStatus: true,
        currentSiteId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Debug: Log pagination result
    console.log('Assets API Debug:', {
      requestedPage: page,
      requestedPerPage: perPage,
      where,
      resultTotal: result.total,
      resultTotalPages: result.totalPages,
      resultDataLength: result.data.length,
      timestamp: new Date().toISOString()
    });

    return Success({
      data: result.data,
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("Get assets error:", error);
    return Error("Failed to fetch assets");
  }
}

// POST - Create new asset
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const validatedData = createSchema.parse(body);
    
    // Convert datetime strings to Date objects
    const data: any = {
      ...validatedData,
    };
    
    if (validatedData.purchaseDate) {
      data.purchaseDate = new Date(validatedData.purchaseDate);
    }
    if (validatedData.nextMaintenanceDate) {
      data.nextMaintenanceDate = new Date(validatedData.nextMaintenanceDate);
    }

    // Verify asset group exists
    const assetGroup = await prisma.assetGroup.findUnique({
      where: { id: validatedData.assetGroupId }
    });
    if (!assetGroup) {
      return BadRequest("Asset group not found");
    }

    // Verify asset category exists and belongs to the asset group
    const assetCategory = await prisma.assetCategory.findUnique({
      where: { id: validatedData.assetCategoryId }
    });
    if (!assetCategory) {
      return BadRequest("Asset category not found");
    }
    if (assetCategory.assetGroupId !== validatedData.assetGroupId) {
      return BadRequest("Asset category does not belong to the selected asset group");
    }

    // Generate asset number
    const lastAsset = await prisma.asset.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    const nextId = (lastAsset?.id || 0) + 1;
    const assetNo = `AST-${nextId.toString().padStart(5, '0')}`;

    const created = await prisma.asset.create({
      data: {
        ...data,
        assetNo,
      },
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        make: true,
        status: true,
        useStatus: true,
        purchaseDate: true,
        nextMaintenanceDate: true,
        supplier: true,
        invoiceNo: true,
        assetGroup: {
          select: {
            id: true,
            assetGroupName: true,
          }
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          }
        },
      }
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('Asset number already exists', 409);
    }
    console.error("Create asset error:", error);
    return Error("Failed to create asset");
  }
}
