import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
import { ROLES } from "@/config/roles";
import { recomputeCashbookBalances } from "@/lib/cashbook-balances";

 const SITE_CODE_MISSING_ERROR = "SITE_CODE_MISSING";

function toDateOnlyUtc(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function generateCashbookVoucherNo(
  tx: typeof prisma,
  opts: { siteId: number }
) {
  const year = new Date().getFullYear();

  const site = await tx.site.findUnique({
    where: { id: opts.siteId },
    select: { siteCode: true },
  });
  if (!site) {
    throw new Error("Invalid site");
  }
  if (!site.siteCode) {
    throw new Error(SITE_CODE_MISSING_ERROR);
  }

  const prefix = `${site.siteCode}/${year}/`;

  const last = await tx.cashbook.findFirst({
    where: { voucherNo: { startsWith: prefix } },
    orderBy: { voucherNo: "desc" },
    select: { voucherNo: true },
  });

  let nextSeq = 1;
  const lastNo = last?.voucherNo;
  if (typeof lastNo === "string" && lastNo.startsWith(prefix)) {
    const parts = lastNo.split("/");
    const lastSeq = Number(parts[2]);
    if (Number.isFinite(lastSeq) && lastSeq >= 1) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqPart = String(nextSeq).padStart(5, "0");
  return `${prefix}${seqPart}`;
}

const createSchema = z.object({
  voucherDate: z.string().min(1, "Voucher date is required"),
  siteId: z.number().int().positive(),
  boqId: z.number().nullable().optional(),
  attachVoucherCopyUrl: z.string().nullable().optional(),
  cashbookDetails: z
    .array(
      z.object({
        cashbookHeadId: z.coerce.number().min(1, "Cashbook head is required"),
        description: z.string().nullable().optional(),
        openingBalance: z.coerce.number().nullable().optional(),
        closingBalance: z.coerce.number().nullable().optional(),
        amountReceived: z.coerce.number().nullable().optional(),
        amountPaid: z.coerce.number().nullable().optional(),
        documentUrl: z.string().nullable().optional(),
      })
    )
    .min(1, "At least one cashbook detail is required"),
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
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const isVoucher = searchParams.get("isVoucher")?.trim() || "";
    const approval1Pending = (searchParams.get("approval1Pending") || "")
      .trim()
      .toLowerCase();
    const approval2Pending = (searchParams.get("approval2Pending") || "")
      .trim()
      .toLowerCase();
    const sort = (searchParams.get("sort") || "voucherDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

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
      where.OR.push({
        cashbookDetails: { some: { documentUrl: { not: null } } },
      });
    } else if (isVoucher === "no") {
      where.AND = where.AND || [];
      where.AND.push({ attachVoucherCopyUrl: null });
      where.AND.push({
        cashbookDetails: { none: { documentUrl: { not: null } } },
      });
    }

    // Filter by Approval 1 pending
    if (approval1Pending === "1" || approval1Pending === "true" || approval1Pending === "yes") {
      where.isApproved1 = false;
    }

    // Filter by Approval 2 pending
    if (approval2Pending === "1" || approval2Pending === "true" || approval2Pending === "yes") {
      where.isApproved1 = true;
      where.isApproved2 = false;
    }

    // Allow listed sortable fields only
    const sortableFields = new Set(["voucherNo", "voucherDate", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { voucherDate: "desc" };

    // Site-based visibility: only ADMIN can see all cashbooks; others only assigned sites
    if (auth.user.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      // Apply restrictive filter (will yield empty if none)
      where.siteId = { in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1] };
    }

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
        createdById: true,
        updatedById: true,
        isApproved1: true,
        approved1ById: true,
        approved1At: true,
        isApproved2: true,
        approved2ById: true,
        approved2At: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approved1By: { select: { id: true, name: true, email: true } },
        approved2By: { select: { id: true, name: true, email: true } },
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

    const voucherDateObj = toDateOnlyUtc(voucherDate);

    let created: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const voucherNo = await generateCashbookVoucherNo(tx as any, { siteId });

          const createdRow = await tx.cashbook.create({
            data: {
              voucherNo,
              voucherDate: voucherDateObj,
              siteId,
              boqId,
              attachVoucherCopyUrl: finalAttachVoucherUrl,
              createdById: auth.user.id,
              updatedById: auth.user.id,
              cashbookDetails: {
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
              },
            },
            select: { id: true },
          });

          await recomputeCashbookBalances({
            tx: tx as any,
            siteId,
            boqId,
            fromVoucherDate: voucherDateObj,
          });

          const refreshed = await tx.cashbook.findUnique({
            where: { id: createdRow.id },
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

          if (!refreshed) throw new Error("Failed to load created cashbook");
          return refreshed;
        });
        break;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = (e.meta as any)?.target;
          if (Array.isArray(target) && target.includes("voucherNo")) {
            continue;
          }
        }
        throw e;
      }
    }
    if (!created) throw new Error("Failed to generate unique voucher number");
    // Budget recompute disabled: received amount tracking removed

    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error instanceof Error && error.message === SITE_CODE_MISSING_ERROR) {
      return BadRequest(
        "Site Code is not added. Please add Site Code to generate the Voucher Number."
      );
    }
    console.error("Create cashbook error:", error);
    return ApiError("Failed to create cashbook");
  }
}
