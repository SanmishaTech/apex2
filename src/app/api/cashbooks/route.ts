import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import {
  handleFileUpload,
  imageUploadConfig,
  documentUploadConfig,
} from "@/lib/upload";
import type { UploadConfig } from "@/lib/upload";

const createSchema = z.object({
  voucherDate: z.string().min(1, "Voucher date is required"),
  siteId: z.number().nullable().optional(),
  boqId: z.number().nullable().optional(),
  attachVoucherCopyUrl: z.string().nullable().optional(),
  cashbookDetails: z.array(z.object({
    cashbookHeadId: z.number().min(1, "Cashbook head is required"),
    date: z.string().min(1, "Date is required"),
    description: z.string().nullable().optional(),
    openingBalance: z.number().nullable().optional(),
    closingBalance: z.number().nullable().optional(),
    amountReceived: z.number().nullable().optional(),
    amountPaid: z.number().nullable().optional(),
    documentUrl: z.string().nullable().optional(),
  })).min(1, "At least one cashbook detail is required"),
});

const CASHBOOK_UPLOAD_CONFIG: UploadConfig = {
  allowedTypes: Array.from(
    new Set([
      ...imageUploadConfig.allowedTypes,
      ...documentUploadConfig.allowedTypes,
    ])
  ),
  maxSize: Math.max(imageUploadConfig.maxSize, documentUploadConfig.maxSize),
  uploadDir: "uploads/cashbooks",
};

async function uploadCashbookFile(file: File, prefix: string) {
  if (!file || file.size === 0) return null;
  const upload = await handleFileUpload(file, CASHBOOK_UPLOAD_CONFIG, prefix);
  if (!upload.success || !upload.filename) {
    throw new Error(upload.error || "Failed to upload file");
  }
  return `/uploads/cashbooks/${upload.filename}`;
}

// GET /api/cashbooks?search=&page=1&perPage=10&sort=voucherDate&order=desc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const isVoucher = searchParams.get("isVoucher")?.trim() || "";
    const sort = (searchParams.get("sort") || "voucherDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { voucherNo: { contains: search } },
        { site: { site: { contains: search } } },
        { boq: { boqNo: { contains: search } } },
      ];
    }

    // Filter by voucher attachment
    if (isVoucher === "yes") {
      where.OR = where.OR || [];
      where.OR.push({ attachVoucherCopyUrl: { not: null } });
      where.OR.push({ cashbookDetails: { some: { documentUrl: { not: null } } } });
    } else if (isVoucher === "no") {
      where.AND = where.AND || [];
      where.AND.push({ attachVoucherCopyUrl: null });
      where.AND.push({ cashbookDetails: { none: { documentUrl: { not: null } } } });
    }

    // Allow listed sortable fields only
    const sortableFields = new Set(["voucherNo", "voucherDate", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { voucherDate: "desc" };

    const result = await paginate({
      model: prisma.cashbook as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        voucherNo: true,
        voucherDate: true,
        attachVoucherCopyUrl: true,
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } },
        createdAt: true,
        updatedAt: true,
        _count: { select: { cashbookDetails: true } },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get cashbooks error:", error);
    return ApiError("Failed to fetch cashbooks");
  }
}

// POST /api/cashbooks (create cashbook)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get("content-type") || "";
    let payloadData: unknown;
    let attachVoucherCopyFile: File | null = null;
    const detailFiles: Record<number, File> = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const rawPayload = form.get("payload");
      if (typeof rawPayload !== "string") {
        return BadRequest("Invalid payload");
      }
      try {
        payloadData = JSON.parse(rawPayload);
      } catch (parseError) {
        return BadRequest("Malformed payload JSON");
      }

      const voucherFile = form.get("attachVoucherCopy");
      if (voucherFile instanceof File && voucherFile.size > 0) {
        attachVoucherCopyFile = voucherFile;
      }

      form.forEach((value, key) => {
        if (value instanceof File && key.startsWith("detailDocument[")) {
          const match = key.match(/^detailDocument\[(\d+)\]$/);
          if (match) {
            const index = Number(match[1]);
            if (!Number.isNaN(index)) {
              detailFiles[index] = value;
            }
          }
        }
      });
    } else {
      payloadData = await req.json();
    }

    const {
      voucherDate,
      siteId,
      boqId,
      attachVoucherCopyUrl,
      cashbookDetails,
    } = createSchema.parse(payloadData);

    let finalAttachVoucherUrl = attachVoucherCopyUrl ?? null;
    if (attachVoucherCopyFile) {
      finalAttachVoucherUrl = await uploadCashbookFile(
        attachVoucherCopyFile,
        "cashbook-voucher"
      );
    }

    const detailDocumentUrls: Record<number, string> = {};
    const detailFileEntries = Object.entries(detailFiles);
    if (detailFileEntries.length > 0) {
      for (const [indexStr, file] of detailFileEntries) {
        const index = Number(indexStr);
        if (Number.isNaN(index)) continue;
        try {
          const uploadedUrl = await uploadCashbookFile(
            file,
            `cashbook-detail-${index + 1}`
          );
          if (uploadedUrl) {
            detailDocumentUrls[index] = uploadedUrl;
          }
        } catch (uploadError) {
          console.error("Cashbook detail upload error:", uploadError);
        }
      }
    }

    // Generate voucher number
    const lastCashbook = await prisma.cashbook.findFirst({
      where: { voucherNo: { not: null } },
      orderBy: { voucherNo: "desc" },
      select: { voucherNo: true }
    });
    
    let nextNumber = 1;
    if (lastCashbook?.voucherNo) {
      const match = lastCashbook.voucherNo.match(/VCH-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const voucherNo = `VCH-${nextNumber.toString().padStart(5, '0')}`;
    
    const created = await prisma.cashbook.create({
      data: {
        voucherNo,
        voucherDate: new Date(voucherDate),
        siteId,
        boqId,
        attachVoucherCopyUrl: finalAttachVoucherUrl,
        cashbookDetails: {
          create: cashbookDetails.map((detail, detailIndex) => ({
            cashbookHeadId: detail.cashbookHeadId,
            date: new Date(detail.date),
            description: detail.description,
            openingBalance: detail.openingBalance ? parseFloat(detail.openingBalance.toString()) : null,
            closingBalance: detail.closingBalance ? parseFloat(detail.closingBalance.toString()) : null,
            amountReceived: detail.amountReceived ? parseFloat(detail.amountReceived.toString()) : null,
            amountPaid: detail.amountPaid ? parseFloat(detail.amountPaid.toString()) : null,
            documentUrl:
              detailDocumentUrls[detailIndex] ?? detail.documentUrl ?? null,
          }))
        }
      },
      include: {
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } },
        cashbookDetails: {
          include: {
            cashbookHead: { select: { id: true, cashbookHeadName: true } }
          }
        }
      },
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create cashbook error:", error);
    return ApiError("Failed to create cashbook");
  }
}
