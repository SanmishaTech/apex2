import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import {
  handleFileUpload,
  imageUploadConfig,
  documentUploadConfig,
} from "@/lib/upload";
import type { UploadConfig } from "@/lib/upload";
import { recomputeBudgetForCashbook, recomputeBudgetByKey } from "@/lib/cashbook-budget-utils";

const updateSchema = z.object({
  voucherDate: z.string().optional(),
  siteId: z.number().nullable().optional(),
  boqId: z.number().nullable().optional(),
  attachVoucherCopyUrl: z.string().nullable().optional(),
  cashbookDetails: z
    .array(
      z.object({
        id: z.number().optional(), // For existing details
        cashbookHeadId: z.number().min(1, "Cashbook head is required"),
        date: z.string().min(1, "Date is required"),
        description: z.string().nullable().optional(),
        openingBalance: z.number().nullable().optional(),
        closingBalance: z.number().nullable().optional(),
        amountReceived: z.number().nullable().optional(),
        amountPaid: z.number().nullable().optional(),
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
        createdAt: true,
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
          date: new Date(detail.date),
          description: detail.description,
          openingBalance: detail.openingBalance
            ? parseFloat(detail.openingBalance.toString())
            : null,
          closingBalance: detail.closingBalance
            ? parseFloat(detail.closingBalance.toString())
            : null,
          amountReceived: detail.amountReceived
            ? parseFloat(detail.amountReceived.toString())
            : null,
          amountPaid: detail.amountPaid
            ? parseFloat(detail.amountPaid.toString())
            : null,
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
    // Recompute budgets for old context (in case details/heads/site/boq moved away from it)
    if (existing) {
      const oldMonth = ((): string => {
        const d = new Date(existing.createdAt);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${mm}-${yyyy}`;
      })();
      await recomputeBudgetByKey({
        siteId: existing.siteId ?? null,
        boqId: existing.boqId ?? null,
        month: oldMonth,
      });
    }

    // Recompute budgets for new context
    await recomputeBudgetForCashbook(updated.id);

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
        createdAt: true,
        cashbookDetails: { select: { cashbookHeadId: true } },
      },
    });

    await prisma.cashbook.delete({ where: { id } });

    // Recompute for deleted record's context
    if (existing) {
      const d = new Date(existing.createdAt);
      const month = `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
      await recomputeBudgetByKey({
        siteId: existing.siteId ?? null,
        boqId: existing.boqId ?? null,
        month,
      });
    }

    return Success({ message: "Cashbook deleted successfully" });
  } catch (error) {
    if ((error as any).code === "P2025") return NotFound("Cashbook not found");
    console.error("Delete cashbook error:", error);
    return ApiError("Failed to delete cashbook");
  }
}
