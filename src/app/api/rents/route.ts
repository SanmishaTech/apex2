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

// Helper to coerce optional numeric fields that may arrive as strings from forms
function toOptionalNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeRentPayload(input: any) {
  if (!input || typeof input !== "object") return input;
  return {
    ...input,
    siteId: toOptionalNumber(input.siteId),
    boqId: toOptionalNumber(input.boqId),
    rentalCategoryId: toOptionalNumber(input.rentalCategoryId),
    rentTypeId: toOptionalNumber(input.rentTypeId),
    depositAmount: toOptionalNumber(input.depositAmount),
    rentAmount: toOptionalNumber(input.rentAmount),
  };
}

const createRentSchema = z.object({
  siteId: z.number().int().positive().optional(),
  boqId: z.number().int().positive().optional(),
  rentalCategoryId: z.number().int().positive().optional(),
  rentTypeId: z.number().int().positive().optional(),
  owner: z.string().optional(),
  pancardNo: z.string().optional(),
  rentDay: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  depositAmount: z.number().optional(),
  rentAmount: z.number().optional(),
  bank: z.string().optional(),
  branch: z.string().optional(),
  accountNo: z.string().optional(),
  accountName: z.string().optional(),
  ifscCode: z.string().optional(),
  momCopyUrl: z
    .any()
    .refine(
      (val) =>
        !val ||
        val instanceof File ||
        (typeof val === "string" && val.trim().length > 0),
      "Invalid file input"
    )
    .optional(),
});

const rentSelectFields = {
  id: true,
  siteId: true,
  site: { select: { id: true, site: true } },
  boqId: true,
  boq: { select: { id: true, boqNo: true } },
  rentalCategoryId: true,
  rentalCategory: { select: { id: true, rentalCategory: true } },
  rentTypeId: true,
  rentType: { select: { id: true, rentType: true } },
  owner: true,
  pancardNo: true,
  rentDay: true,
  fromDate: true,
  toDate: true,
  description: true,
  depositAmount: true,
  rentAmount: true,
  srNo: true,
  listStatus: true,
  dueDate: true,
  status: true,
  paymentMethod: true,
  utrNumber: true,
  chequeNumber: true,
  chequeDate: true,
  bankDetails: true,
  paymentDate: true,
  bank: true,
  branch: true,
  accountNo: true,
  accountName: true,
  ifscCode: true,
  momCopyUrl: true,
  rentDocuments: {
    select: {
      id: true,
      documentName: true,
      documentUrl: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

async function saveRentDoc(file: File | null, subname: string) {
  if (!file || file.size === 0) return null;
  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowed.includes(file.type || ""))
    throw new Error("Unsupported file type");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("File too large (max 20MB)");
  const ext = path.extname(file.name) || ".bin";
  const filename = `${Date.now()}-${subname}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", "rents");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    Buffer.from(await file.arrayBuffer())
  );
  return `/uploads/rents/${filename}`;
}

// GET - List rents with pagination & search
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
    const fromDate = searchParams.get("fromDate")?.trim() || "";
    const toDate = searchParams.get("toDate")?.trim() || "";
    const sort = searchParams.get("sort") || "srNo";
    const order = searchParams.get("order") === "desc" ? "desc" : "asc";

    const where: any = {};
    if (search) {
      where.OR = [
        { owner: { contains: search } },
        { description: { contains: search } },
        { pancardNo: { contains: search } },
        { site: { site: { contains: search } } },
        { boq: { boqNo: { contains: search } } },
        { rentalCategory: { rentalCategory: { contains: search } } },
        { rentType: { rentType: { contains: search } } },
      ];
    }

    // Date range filtering
    if (fromDate) {
      where.dueDate = { ...where.dueDate, gte: new Date(fromDate) };
    }
    if (toDate) {
      where.dueDate = { ...where.dueDate, lte: new Date(toDate) };
    }

    // Site-based visibility: non-admin and non-projectDirector see only their assigned sites
    const role = auth.user.role;
    const isPrivileged = role === ROLES.ADMIN;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      if (!assignedSiteIds || assignedSiteIds.length === 0) {
        return Success({
          data: [],
          meta: { page, perPage, total: 0, totalPages: 1 },
        });
      }

      where.siteId = { in: assignedSiteIds };
    }

    const result = await paginate({
      model: prisma.rent,
      where,
      orderBy: (sort === "srNo"
        ? [
            { fromDate: order },
            { toDate: order },
            { srNo: order },
            { id: order },
          ]
        : { [sort]: order }) as any,
      page,
      perPage,
      select: rentSelectFields,
    });

    // Debug: Log pagination result
    console.log("Rents API Debug:", {
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
    console.error("Get rents error:", error);
    return ApiError("Failed to fetch rents");
  }
}

// POST - Create new rent with monthly record generation
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let rentDocumentMetadata: Array<{
      id?: number;
      documentName: string;
      documentUrl?: string;
      index: number;
    }> = [];
    const rentDocumentFiles: Array<{ index: number; file: File }> = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const getString = (key: string) => {
        const value = form.get(key);
        return typeof value === "string" ? value : undefined;
      };
      const getFile = (key: string) => {
        const value = form.get(key);
        return value instanceof File ? value : null;
      };

      body = {
        siteId: getString("siteId"),
        boqId: getString("boqId"),
        rentalCategoryId: getString("rentalCategoryId"),
        rentTypeId: getString("rentTypeId"),
        owner: getString("owner"),
        pancardNo: getString("pancardNo"),
        rentDay: getString("rentDay"),
        fromDate: getString("fromDate"),
        toDate: getString("toDate"),
        dueDate: getString("dueDate"),
        description: getString("description"),
        depositAmount: getString("depositAmount"),
        rentAmount: getString("rentAmount"),
        bank: getString("bank"),
        branch: getString("branch"),
        accountNo: getString("accountNo"),
        accountName: getString("accountName"),
        ifscCode: getString("ifscCode"),
        paymentMethod: getString("paymentMethod"),
        utrNumber: getString("utrNumber"),
        chequeNumber: getString("chequeNumber"),
        chequeDate: getString("chequeDate"),
        bankDetails: getString("bankDetails"),
        paymentDate: getString("paymentDate"),
        momCopyUrl:
          getFile("momCopy") ||
          getFile("momCopyUrl") ||
          getString("momCopyUrl"),
      };

      const documentsJson = form.get("rentDocuments");
      if (typeof documentsJson === "string" && documentsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            rentDocumentMetadata = parsed
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
        } catch (err) {
          console.warn("Failed to parse rentDocuments metadata (POST)", err);
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^rentDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) {
          rentDocumentFiles.push({ index: idx, file: fileVal });
        }
      });
    } else {
      const raw = await req.json();
      body = raw;
      if (Array.isArray(raw?.rentDocuments)) {
        rentDocumentMetadata = raw.rentDocuments.map(
          (doc: any, index: number) => ({
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
          })
        );
      }
    }

    const normalizedBody = normalizeRentPayload(body);
    const validatedData = createRentSchema.parse(normalizedBody);

    const { momCopyUrl: momCopyValue, ...rest } = validatedData as any;
    let momCopyUrl: string | undefined;
    if (momCopyValue instanceof File) {
      const saved = await saveRentDoc(momCopyValue, "mom");
      momCopyUrl = saved ?? undefined;
    } else if (typeof momCopyValue === "string" && momCopyValue.trim() !== "") {
      momCopyUrl = momCopyValue.trim();
    }

    const filesByIndex = new Map<number, File>();
    rentDocumentFiles.forEach(({ index, file }) => {
      filesByIndex.set(index, file);
    });

    // Resolve document files/urls once so we can attach the same set to every created monthly record
    const resolvedDocs: Array<{ documentName: string; documentUrl: string }> =
      [];
    if (rentDocumentMetadata.length > 0 || filesByIndex.size > 0) {
      for (const docMeta of rentDocumentMetadata) {
        const name = (docMeta.documentName || "").trim();
        const file = filesByIndex.get(docMeta.index ?? -1);
        const trimmedUrl = docMeta.documentUrl?.trim();
        let finalUrl =
          trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
        if (file) {
          const saved = await saveRentDoc(file, "rent-doc");
          finalUrl = saved ?? undefined;
        }
        if (!name || !finalUrl) continue;
        resolvedDocs.push({ documentName: name, documentUrl: finalUrl });
      }
    }

    const { rentDay, ...restWithoutRentDay } = rest;

    // If both fromDate and toDate are provided, generate monthly records
    if (rest.fromDate && rest.toDate && rentDay) {
      const fromDate = new Date(rest.fromDate);
      const toDate = new Date(rest.toDate);
      const rentDayInt = parseInt(rentDay);

      let dueDate = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        rentDayInt
      );

      if (dueDate < fromDate) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      const createdRents: any[] = [];
      let srNo = 1;

      while (dueDate <= toDate) {
        const rentData: any = {
          ...restWithoutRentDay,
          rentDay,
          fromDate,
          toDate,
          srNo,
          dueDate,
          status: "Unpaid",
          listStatus: null,
          paymentMethod: null,
          utrNumber: null,
          chequeNumber: null,
          chequeDate: null,
          bankDetails: null,
          paymentDate: null,
        };

        if (momCopyUrl) {
          rentData.momCopyUrl = momCopyUrl;
        }

        if (srNo === 1) {
          rentData.listStatus = "First";
          // Keep provided depositAmount on first record
        } else {
          // For subsequent monthly records, do not carry forward depositAmount
          rentData.depositAmount = null;
        }

        const nextDueDate = new Date(dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        if (nextDueDate > toDate) {
          rentData.listStatus = "Last";
        }

        const created: any = await prisma.rent.create({
          data: rentData,
          select: rentSelectFields,
        });

        // Attach documents to each created monthly record, if any were provided
        if (resolvedDocs.length > 0) {
          await prisma.rentDocument.createMany({
            data: resolvedDocs.map((d) => ({
              rentId: created.id as number,
              documentName: d.documentName,
              documentUrl: d.documentUrl,
            })),
          });
        }

        createdRents.push(created);

        dueDate.setMonth(dueDate.getMonth() + 1);
        srNo++;
      }

      return Success(
        {
          message: `Created ${createdRents.length} monthly rent records`,
          data: createdRents,
        },
        201
      );
    } else {
      const rentData: any = {
        ...rest,
        status: "Unpaid",
        paymentMethod: null,
        utrNumber: null,
        chequeNumber: null,
        chequeDate: null,
        bankDetails: null,
        paymentDate: null,
      };

      if (
        rest.fromDate &&
        typeof rest.fromDate === "string" &&
        rest.fromDate.trim() !== ""
      ) {
        rentData.fromDate = new Date(rest.fromDate);
      } else {
        delete rentData.fromDate;
      }
      if (
        rest.toDate &&
        typeof rest.toDate === "string" &&
        rest.toDate.trim() !== ""
      ) {
        rentData.toDate = new Date(rest.toDate);
      } else {
        delete rentData.toDate;
      }
      if (
        rest.dueDate &&
        typeof rest.dueDate === "string" &&
        rest.dueDate.trim() !== ""
      ) {
        rentData.dueDate = new Date(rest.dueDate);
      }

      if (momCopyUrl) {
        rentData.momCopyUrl = momCopyUrl;
      }

      const created: any = await prisma.rent.create({
        data: rentData,
        select: rentSelectFields,
      });

      if (resolvedDocs.length > 0) {
        await prisma.rentDocument.createMany({
          data: resolvedDocs.map((d) => ({
            rentId: created.id as number,
            documentName: d.documentName,
            documentUrl: d.documentUrl,
          })),
        });
      }

      return Success(created, 201);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create rent error:", error);
    return ApiError("Failed to create rent");
  }
}
