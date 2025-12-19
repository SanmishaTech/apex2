import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import {
  handleFileUpload,
  imageUploadConfig,
  documentUploadConfig,
} from "@/lib/upload";
import type { UploadConfig } from "@/lib/upload";

const updateSchema = z.object({
  voucherDate: z.string().optional(),
  siteId: z.number().nullable().optional(),
  boqId: z.number().nullable().optional(),
  attachVoucherCopyUrl: z.string().nullable().optional(),
  cashbookDetails: z
    .array(
      z.object({
        id: z.number().optional(), // For existing details
        cashbookHeadId: z.coerce.number().min(1, "Cashbook head is required"),
        description: z.string().nullable().optional(),
        openingBalance: z.coerce.number().nullable().optional(),
        closingBalance: z.coerce.number().nullable().optional(),
        amountReceived: z.coerce.number().nullable().optional(),
        amountPaid: z.coerce.number().nullable().optional(),
        documentUrl: z.string().nullable().optional(),
      })
    )
    .optional(),
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

// GET /api/cashbooks/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid ID");

    const cashbook = await prisma.cashbook.findUnique({
      where: { id },
      include: {
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } },
        cashbookDetails: {
          include: {
            cashbookHead: { select: { id: true, cashbookHeadName: true } },
          },
        },
      },
    });

    if (!cashbook) return NotFound("Cashbook not found");
    return Success(cashbook);
  } catch (error) {
    console.error("Get cashbook error:", error);
    return ApiError("Failed to fetch cashbook");
  }
}

// PATCH /api/cashbooks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid ID");

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
    } = updateSchema.parse(payloadData);

    // Fetch existing record to compute old context before update
    const existing = await prisma.cashbook.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        boqId: true,
        voucherDate: true,
        cashbookDetails: { select: { cashbookHeadId: true } },
      },
    });

    const updateData: any = {};
    if (voucherDate) updateData.voucherDate = new Date(voucherDate);
    if (siteId !== undefined) updateData.siteId = siteId;
    if (boqId !== undefined) updateData.boqId = boqId;

    if (attachVoucherCopyFile) {
      updateData.attachVoucherCopyUrl = await uploadCashbookFile(
        attachVoucherCopyFile,
        "cashbook-voucher"
      );
    } else if (attachVoucherCopyUrl !== undefined) {
      updateData.attachVoucherCopyUrl = attachVoucherCopyUrl;
    }

    if (cashbookDetails) {
      await prisma.cashbookDetail.deleteMany({
        where: { cashbookId: id },
      });

      const detailDocumentUrls: Record<number, string> = {};
      const detailFileEntries = Object.entries(detailFiles);
      if (detailFileEntries.length > 0) {
        for (const [indexStr, file] of detailFileEntries) {
          const index = Number(indexStr);
          if (Number.isNaN(index)) continue;
          const uploadedUrl = await uploadCashbookFile(
            file,
            `cashbook-detail-${index + 1}`
          );
          if (uploadedUrl) {
            detailDocumentUrls[index] = uploadedUrl;
          }
        }
      }

      updateData.cashbookDetails = {
        create: cashbookDetails.map((detail, detailIndex) => ({
          cashbookHeadId: detail.cashbookHeadId,
          description: detail.description ?? null,
          openingBalance: detail.openingBalance ?? null,
          closingBalance: detail.closingBalance ?? null,
          amountReceived: detail.amountReceived ?? null,
          amountPaid: detail.amountPaid ?? null,
          documentUrl:
            detailDocumentUrls[detailIndex] ?? detail.documentUrl ?? null,
        })),
      };
    }

    const updated = await prisma.cashbook.update({
      where: { id },
      data: updateData,
      include: {
        site: { select: { id: true, site: true } },
        boq: { select: { id: true, boqNo: true } },
        cashbookDetails: {
          include: {
            cashbookHead: { select: { id: true, cashbookHeadName: true } },
          },
        },
      },
    });
    // Budget recompute disabled: received amount tracking removed

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if ((error as any).code === "P2025") return NotFound("Cashbook not found");
    console.error("Update cashbook error:", error);
    return ApiError("Failed to update cashbook");
  }
}

// DELETE /api/cashbooks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid ID");

    // Fetch context before delete
    const existing = await prisma.cashbook.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        boqId: true,
        voucherDate: true,
        cashbookDetails: { select: { cashbookHeadId: true } },
      },
    });

    await prisma.cashbook.delete({ where: { id } });

    // Budget recompute disabled: received amount tracking removed

    return Success({ message: "Cashbook deleted successfully" });
  } catch (error) {
    if ((error as any).code === "P2025") return NotFound("Cashbook not found");
    console.error("Delete cashbook error:", error);
    return ApiError("Failed to delete cashbook");
  }
}
