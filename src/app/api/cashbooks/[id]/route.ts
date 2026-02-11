import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  Forbidden,
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
import { recomputeCashbookBalances } from "@/lib/cashbook-balances";
import { PERMISSIONS, ROLES } from "@/config/roles";

function toDateOnlyUtc(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const updateSchema = z.object({
  statusAction: z.enum(["approve1", "approve2"]).optional(),
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
        createdBy: { select: { id: true, name: true, email: true } },
        approved1By: { select: { id: true, name: true, email: true } },
        approved2By: { select: { id: true, name: true, email: true } },
        cashbookDetails: {
          include: {
            cashbookHead: { select: { id: true, cashbookHeadName: true } },
          },
        },
      },
    });

    if (!cashbook) return NotFound("Cashbook not found");

    if (auth.user.role !== ROLES.ADMIN) {
      const siteId = cashbook.siteId;
      // If cashbook is not tied to a site, do not block.
      if (typeof siteId === "number") {
        const employee = await prisma.employee.findFirst({
          where: { userId: auth.user.id },
          select: { siteEmployees: { select: { siteId: true } } },
        });
        const assignedSiteIds: number[] = (employee?.siteEmployees || [])
          .map((s) => s.siteId)
          .filter((v): v is number => typeof v === "number");
        if (!assignedSiteIds.includes(siteId)) {
          return Forbidden("Site is not assigned to current user");
        }
      }
    }

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
      statusAction,
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
        createdById: true,
        updatedById: true,
        isApproved1: true,
        approved1ById: true,
        approved1At: true,
        isApproved2: true,
        approved2ById: true,
        approved2At: true,
        cashbookDetails: { select: { cashbookHeadId: true } },
      },
    });
    if (!existing) return NotFound("Cashbook not found");

    if (auth.user.role !== ROLES.ADMIN) {
      const currentSiteId = existing.siteId;
      if (typeof currentSiteId === "number") {
        const employee = await prisma.employee.findFirst({
          where: { userId: auth.user.id },
          select: { siteEmployees: { select: { siteId: true } } },
        });
        const assignedSiteIds: number[] = (employee?.siteEmployees || [])
          .map((s) => s.siteId)
          .filter((v): v is number => typeof v === "number");
        if (!assignedSiteIds.includes(currentSiteId)) {
          return Forbidden("Site is not assigned to current user");
        }

        // If changing siteId, ensure the new siteId is also assigned
        if (siteId !== undefined && siteId !== null) {
          if (!assignedSiteIds.includes(siteId)) {
            return Forbidden("Site is not assigned to current user");
          }
        }
      }
    }

    // If boqId is provided, ensure it belongs to the (new or existing) site.
    const effectiveSiteIdForBoq =
      siteId !== undefined ? siteId : existing.siteId;
    if (boqId !== undefined && boqId !== null) {
      if (!effectiveSiteIdForBoq) {
        return BadRequest("siteId is required when selecting a BOQ");
      }
      const boq = await prisma.boq.findUnique({
        where: { id: boqId },
        select: { id: true, siteId: true },
      });
      if (!boq || boq.siteId !== effectiveSiteIdForBoq) {
        return BadRequest("Invalid BOQ for selected site");
      }
    }

    // Prevent creator from approving their own cashbook
    if (
      (statusAction === "approve1" || statusAction === "approve2") &&
      existing.createdById === auth.user.id
    ) {
      return BadRequest("Creator cannot approve their own cashbook");
    }

    // Edits blocked once approved
    if (!statusAction && (existing.isApproved1 || existing.isApproved2)) {
      return BadRequest("Approved cashbook cannot be edited");
    }

    // Permission check for normal edits (approve actions have their own permissions)
    if (!statusAction) {
      const rolePerms = (auth.user.permissions || []) as string[];
      if (!rolePerms.includes(PERMISSIONS.EDIT_CASHBOOKS)) {
        return Forbidden("Missing permission to edit cashbook");
      }
    }

    const updateData: any = {};
    const now = new Date();

    if (statusAction === "approve1") {
      const rolePerms = (auth.user.permissions || []) as string[];
      if (!rolePerms.includes(PERMISSIONS.APPROVE_CASHBOOKS_L1)) {
        return Forbidden("Missing permission to approve level 1");
      }
      if (existing.isApproved1) {
        return BadRequest("Cashbook already approved (level 1)");
      }
      updateData.isApproved1 = true;
      updateData.approved1ById = auth.user.id;
      updateData.approved1At = now;
    }

    if (statusAction === "approve2") {
      const rolePerms = (auth.user.permissions || []) as string[];
      if (!rolePerms.includes(PERMISSIONS.APPROVE_CASHBOOKS_L2)) {
        return Forbidden("Missing permission to approve level 2");
      }
      if (!existing.isApproved1) {
        return BadRequest("Only level 1 approved cashbook can be approved (level 2)");
      }
      if (existing.isApproved2) {
        return BadRequest("Cashbook already approved (level 2)");
      }
      if (existing.approved1ById === auth.user.id) {
        return BadRequest("Level 1 approver cannot approve level 2");
      }
      updateData.isApproved2 = true;
      updateData.approved2ById = auth.user.id;
      updateData.approved2At = now;
    }

    if (!statusAction) {
      if (voucherDate !== undefined) {
        updateData.voucherDate = toDateOnlyUtc(voucherDate);
      }
      if (siteId !== undefined) updateData.siteId = siteId;
      if (boqId !== undefined) updateData.boqId = boqId;
    }

    if (attachVoucherCopyFile) {
      updateData.attachVoucherCopyUrl = await uploadCashbookFile(
        attachVoucherCopyFile,
        "cashbook-voucher"
      );
    } else if (attachVoucherCopyUrl !== undefined) {
      updateData.attachVoucherCopyUrl = attachVoucherCopyUrl;
    }

    if (!statusAction && cashbookDetails) {
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

    updateData.updatedById = auth.user.id;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedRow = await tx.cashbook.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          siteId: true,
          boqId: true,
          voucherDate: true,
          cashbookDetails: { select: { cashbookHeadId: true } },
        },
      });

      const siteForRecompute = updatedRow.siteId ?? existing.siteId;
      const boqForRecompute = updatedRow.boqId ?? existing.boqId;
      const fromVoucherDate =
        existing.voucherDate && updatedRow.voucherDate
          ? new Date(
              Math.min(
                new Date(existing.voucherDate).getTime(),
                new Date(updatedRow.voucherDate).getTime()
              )
            )
          : updatedRow.voucherDate ?? existing.voucherDate;

      if (!statusAction && fromVoucherDate) {
        await recomputeCashbookBalances({
          tx: tx as any,
          siteId: siteForRecompute,
          boqId: boqForRecompute,
          fromVoucherDate,
        });
      }

      const refreshed = await tx.cashbook.findUnique({
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
      if (!refreshed) throw new Error("Failed to load updated cashbook");
      return refreshed;
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
    const rolePerms = (auth.user.permissions || []) as string[];
    if (!rolePerms.includes(PERMISSIONS.DELETE_CASHBOOKS)) {
      return Forbidden("Missing permission to delete cashbook");
    }

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
        isApproved1: true,
        isApproved2: true,
        cashbookDetails: { select: { cashbookHeadId: true } },
      },
    });
    if (!existing) return NotFound("Cashbook not found");

    if (existing.isApproved1 || existing.isApproved2) {
      return BadRequest("Approved cashbook cannot be deleted");
    }

    if (auth.user.role !== ROLES.ADMIN) {
      const currentSiteId = existing.siteId;
      if (typeof currentSiteId === "number") {
        const employee = await prisma.employee.findFirst({
          where: { userId: auth.user.id },
          select: { siteEmployees: { select: { siteId: true } } },
        });
        const assignedSiteIds: number[] = (employee?.siteEmployees || [])
          .map((s) => s.siteId)
          .filter((v): v is number => typeof v === "number");
        if (!assignedSiteIds.includes(currentSiteId)) {
          return Forbidden("Site is not assigned to current user");
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.cashbook.delete({ where: { id } });
      await recomputeCashbookBalances({
        tx: tx as any,
        siteId: existing.siteId,
        boqId: existing.boqId,
        fromVoucherDate: existing.voucherDate,
      });
    });

    // Budget recompute disabled: received amount tracking removed

    return Success({ message: "Cashbook deleted successfully" });
  } catch (error) {
    if ((error as any).code === "P2025") return NotFound("Cashbook not found");
    console.error("Delete cashbook error:", error);
    return ApiError("Failed to delete cashbook");
  }
}
