import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ROLES } from "@/config/roles";

const createSchema = z.object({
  assetGroupId: z.number().int().positive(),
  assetCategoryId: z.number().int().positive(),
  assetName: z.string().min(1),
  make: z.string().optional(),
  description: z.string().optional(),
  purchaseDate: z.string().optional(),
  invoiceNo: z.string().optional(),
  supplier: z.string().optional(),
  invoiceCopyUrl: z.string().optional().nullable(),
  nextMaintenanceDate: z.string().optional(),
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
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
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
    if (status) {
      where.status = status;
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

    // Site-based visibility: only ADMIN can see all; others limited to assigned sites
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      const inIds = assignedSiteIds.length > 0 ? assignedSiteIds : [-1];
      if (currentSiteId) {
        const requested = parseInt(currentSiteId);
        (where as any).currentSiteId = inIds.includes(requested)
          ? requested
          : -1;
      } else {
        (where as any).currentSiteId = { in: inIds };
      }
    }

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
          },
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          },
        },
        transferStatus: true,
        currentSiteId: true,
        currentSite: {
          select: {
            id: true,
            shortName: true,
            site: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Debug: Log pagination result
    console.log("Assets API Debug:", {
      requestedPage: page,
      requestedPerPage: perPage,
      where,
      resultTotal: result.total,
      resultTotalPages: result.totalPages,
      resultDataLength: result.data.length,
      timestamp: new Date().toISOString(),
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
    return ApiError("Failed to fetch assets");
  }
}

async function saveAssetDoc(file: File | null, subname: string) {
  if (!file || file.size === 0) return null;
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type || "")) {
    const t = file.type || "unknown";
    throw new Error(`Unsupported file type: ${t}`);
  }
  if (file.size > 20 * 1024 * 1024) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File too large (${mb}MB). Max 20MB`);
  }
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${subname}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", "assets");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    Buffer.from(await file.arrayBuffer())
  );
  return `/uploads/assets/${filename}`;
}

// POST - Create new asset (supports multipart with assetDocuments)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let assetDocumentMetadata: Array<{
      id?: number;
      documentName: string;
      documentUrl?: string;
      index: number;
    }> = [];
    const assetDocumentFiles: Array<{ index: number; file: File }> = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const get = (k: string) => form.get(k) as string | null;
      body = {
        assetGroupId: get("assetGroupId"),
        assetCategoryId: get("assetCategoryId"),
        assetName: get("assetName"),
        make: get("make"),
        description: get("description"),
        purchaseDate: get("purchaseDate"),
        invoiceNo: get("invoiceNo"),
        supplier: get("supplier"),
        invoiceCopyUrl: get("invoiceCopyUrl"),
        nextMaintenanceDate: get("nextMaintenanceDate"),
        status: get("status"),
        useStatus: get("useStatus"),
      };

      const documentsJson = form.get("assetDocuments");
      if (typeof documentsJson === "string" && documentsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            assetDocumentMetadata = parsed
              .filter((doc: any) => doc && typeof doc === "object")
              .map((doc: any, index: number) => ({
                id:
                  typeof doc.id === "number" && Number.isFinite(doc.id)
                    ? doc.id
                    : undefined,
                documentName: String(doc.documentName || ""),
                documentUrl:
                  typeof doc.documentUrl === "string" &&
                  doc.documentUrl.trim() !== ""
                    ? doc.documentUrl
                    : undefined,
                index,
              }));
          }
        } catch (e) {
          console.warn("Failed to parse assetDocuments metadata (POST)", e);
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^assetDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File)
          assetDocumentFiles.push({ index: idx, file: fileVal });
      });
    } else {
      body = await req.json();
      assetDocumentMetadata = Array.isArray((body as any)?.assetDocuments)
        ? (body as any).assetDocuments.map((doc: any, index: number) => ({
            id:
              typeof doc?.id === "number" && Number.isFinite(doc.id)
                ? doc.id
                : undefined,
            documentName: String(doc?.documentName || ""),
            documentUrl:
              typeof doc?.documentUrl === "string" &&
              doc.documentUrl.trim() !== ""
                ? doc.documentUrl
                : undefined,
            index,
          }))
        : [];
    }

    // Pre-validate all uploaded files (type & size) BEFORE creating any DB rows
    if (assetDocumentFiles.length > 0) {
      const allowed = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      for (const { file } of assetDocumentFiles) {
        const type = file.type || "";
        if (!allowed.includes(type)) {
          const t = type || "unknown";
          return BadRequest(`Unsupported file type: ${t}`);
        }
        if (file.size > 20 * 1024 * 1024) {
          const mb = (file.size / (1024 * 1024)).toFixed(2);
          return BadRequest(`File too large (${mb}MB). Max 20MB`);
        }
      }
    }

    // Normalize: convert explicit nulls to undefined so optional fields pass validation/defaults
    if (body && typeof body === "object") {
      Object.entries(body).forEach(([k, v]) => {
        if (v === null) (body as any)[k] = undefined;
      });
    }

    const validatedData = createSchema.parse({
      ...body,
      assetGroupId: body.assetGroupId
        ? Number(body.assetGroupId)
        : body.assetGroupId,
      assetCategoryId: body.assetCategoryId
        ? Number(body.assetCategoryId)
        : body.assetCategoryId,
    });

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
      where: { id: validatedData.assetGroupId },
    });
    if (!assetGroup) {
      return BadRequest("Asset group not found");
    }

    // Verify asset category exists and belongs to the asset group
    const assetCategory = await prisma.assetCategory.findUnique({
      where: { id: validatedData.assetCategoryId },
    });
    if (!assetCategory) {
      return BadRequest("Asset category not found");
    }
    if (assetCategory.assetGroupId !== validatedData.assetGroupId) {
      return BadRequest(
        "Asset category does not belong to the selected asset group"
      );
    }

    // Generate asset number from last assetNo (e.g., AST-00001 -> AST-00002)
    const lastByAssetNo = await prisma.asset.findFirst({
      orderBy: { assetNo: "desc" },
      select: { assetNo: true },
    });
    const lastNo = lastByAssetNo?.assetNo || "";
    const match = lastNo.match(/(\d+)$/);
    const lastSeq = match ? parseInt(match[1], 10) : 0;
    const nextSeq = lastSeq + 1;
    const assetNo = `AST-${nextSeq.toString().padStart(5, "0")}`;

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
          },
        },
        assetCategory: {
          select: {
            id: true,
            category: true,
          },
        },
      },
    });

    // After asset is created, persist any assetDocuments (metadata + files)
    if (assetDocumentMetadata.length > 0 || assetDocumentFiles.length > 0) {
      const filesByIndex = new Map<number, File>();
      assetDocumentFiles.forEach(({ index, file }) =>
        filesByIndex.set(index, file)
      );

      const createPayload: Array<{
        assetId: number;
        documentName: string;
        documentUrl: string;
      }> = [];
      for (const docMeta of assetDocumentMetadata) {
        const name = (docMeta.documentName || "").trim();
        const file = filesByIndex.get(docMeta.index ?? -1);
        const trimmedUrl = docMeta.documentUrl?.trim();
        let finalUrl =
          trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
        if (file) {
          const saved = await saveAssetDoc(file, "asset-doc");
          finalUrl = saved ?? undefined;
        }
        if (!name || !finalUrl) continue;
        createPayload.push({
          assetId: created.id,
          documentName: name,
          documentUrl: finalUrl,
        });
      }
      if (createPayload.length > 0) {
        await prisma.assetDocument.createMany({ data: createPayload });
      }
    }

    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    // Surface specific file validation errors as 400 so UI can show them
    if (
      error instanceof Error &&
      (error.message.startsWith("Unsupported file type") ||
        error.message.startsWith("File too large"))
    ) {
      return BadRequest(error.message);
    }
    if ((error as any).code === "P2002") {
      return ApiError("Asset number already exists", 409);
    }
    console.error("Create asset error:", error);
    return ApiError("Failed to create asset");
  }
}
