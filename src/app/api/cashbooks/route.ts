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
import { ROLES } from "@/config/roles";
import { recomputeCashbookBalances } from "@/lib/cashbook-balances";

function toDateOnlyUtc(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getCashbookMonthCode(d: Date) {
  // April -> A, May -> B, ... March -> L
  const m = d.getUTCMonth(); // 0=Jan
  const codes = ["J", "K", "L", "A", "B", "C", "D", "E", "F", "G", "H", "I"] as const;
  return codes[m] || "";
}

async function generateCashbookVoucherNo(tx: typeof prisma, voucherDate: Date) {
  const monthCode = getCashbookMonthCode(voucherDate);
  const day = voucherDate.getUTCDate();

  const monthStart = new Date(voucherDate);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const rows = await tx.cashbook.findMany({
    where: {
      voucherDate: {
        gte: monthStart,
        lt: monthEnd,
      },
    },
    select: { voucherNo: true },
  });

  let maxSeq = 0;
  for (const r of rows) {
    const v = r.voucherNo;
    if (!v) continue;
    const parts = v.split("/");
    if (parts.length < 3) continue;
    const seq = Number(parts[2]);
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  const seq = maxSeq + 1;
  return `${monthCode}/${day}/${seq}`;
}

const createSchema = z.object({
  voucherDate: z.string().min(1, "Voucher date is required"),
  siteId: z.number().nullable().optional(),
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

    const created = await prisma.$transaction(async (tx) => {
      const voucherNo = await generateCashbookVoucherNo(tx as any, voucherDateObj);
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
    // Budget recompute disabled: received amount tracking removed

    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create cashbook error:", error);
    return ApiError("Failed to create cashbook");
  }
}
