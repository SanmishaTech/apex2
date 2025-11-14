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
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Helpers to normalize optional numeric fields that may be strings from forms
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

const updateRentSchema = z
  .object({
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
    paymentMethod: z.string().optional(),
    utrNumber: z.string().optional().nullable(),
    chequeNumber: z.string().optional().nullable(),
    chequeDate: z.string().optional().nullable(),
    bankDetails: z.string().optional().nullable(),
    paymentDate: z.string().optional().nullable(),
    momCopyUrl: z.string().optional(),
  })
  .partial();

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
  bank: true,
  branch: true,
  accountNo: true,
  accountName: true,
  ifscCode: true,
  paymentMethod: true,
  utrNumber: true,
  chequeNumber: true,
  chequeDate: true,
  bankDetails: true,
  paymentDate: true,
  momCopyUrl: true,
  rentDocuments: {
    select: {
      id: true,
      documentName: true,
      documentUrl: true,
    },
    orderBy: { id: "asc" },
  },
  createdAt: true,
  updatedAt: true,
} as const;

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

// GET - Get single rent by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    const rent = await prisma.rent.findUnique({
      where: { id },
      select: rentSelectFields as any,
    });

    if (!rent) return NotFound("Rent not found");

    return Success(rent);
  } catch (error) {
    console.error("Get rent error:", error);
    return ApiError("Failed to fetch rent");
  }
}

// PATCH - Update rent
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let rentDocumentMetadata: Array<{
      id?: number;
      documentName?: string;
      documentUrl?: string;
      index: number;
    }> = [];
    let documentsProvided = false;
    const rentDocumentFiles: Array<{ index: number; file: File }> = [];
    let momCopyFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const getString = (key: string) => {
        const value = form.get(key);
        return typeof value === "string" ? value : undefined;
      };

      momCopyFile = (form.get("momCopy") as File) || null;
      if (!(momCopyFile instanceof File)) {
        momCopyFile = (form.get("momCopyUrl") as File) || null;
        if (!(momCopyFile instanceof File)) {
          momCopyFile = null;
        }
      }

      body = {
        id: getString("id"),
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
        momCopyUrl: momCopyFile ?? getString("momCopyUrl"),
      };

      documentsProvided = form.has("rentDocuments");
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
                documentName:
                  typeof doc.documentName === "string"
                    ? doc.documentName
                    : undefined,
                documentUrl:
                  typeof doc.documentUrl === "string"
                    ? doc.documentUrl
                    : undefined,
                index,
              }));
          }
        } catch (err) {
          console.warn("Failed to parse rentDocuments metadata (PATCH)", err);
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
      documentsProvided = Object.prototype.hasOwnProperty.call(
        body ?? {},
        "rentDocuments"
      );
      if (Array.isArray(raw?.rentDocuments)) {
        rentDocumentMetadata = raw.rentDocuments.map(
          (doc: any, index: number) => ({
            id:
              typeof doc?.id === "number" && Number.isFinite(doc.id)
                ? doc.id
                : undefined,
            documentName:
              typeof doc?.documentName === "string"
                ? doc.documentName
                : undefined,
            documentUrl:
              typeof doc?.documentUrl === "string"
                ? doc.documentUrl
                : undefined,
            index,
          })
        );
      }
    }

    const normalizedBody = normalizeRentPayload(body);
    const validatedData = updateRentSchema.parse(normalizedBody);

    // Convert date strings to Date objects if provided and not empty
    const updateData: any = { ...validatedData };
    if (updateData.fromDate && updateData.fromDate.trim() !== "") {
      updateData.fromDate = new Date(updateData.fromDate);
    } else if (updateData.fromDate === "") {
      updateData.fromDate = null; // Set to null to clear the date field
    }
    if (updateData.toDate && updateData.toDate.trim() !== "") {
      updateData.toDate = new Date(updateData.toDate);
    } else if (updateData.toDate === "") {
      updateData.toDate = null; // Set to null to clear the date field
    }
    if (updateData.dueDate && updateData.dueDate.trim() !== "") {
      updateData.dueDate = new Date(updateData.dueDate);
    } else if (updateData.dueDate === "") {
      updateData.dueDate = null; // Set to null to clear the date field
    }
    if (updateData.chequeDate && updateData.chequeDate.trim() !== "") {
      updateData.chequeDate = new Date(updateData.chequeDate);
    } else if (updateData.chequeDate === "" || updateData.chequeDate === null) {
      updateData.chequeDate = null;
    }
    if (updateData.paymentDate && updateData.paymentDate.trim() !== "") {
      updateData.paymentDate = new Date(updateData.paymentDate);
    } else if (
      updateData.paymentDate === "" ||
      updateData.paymentDate === null
    ) {
      updateData.paymentDate = null;
    }

    if (momCopyFile) {
      updateData.momCopyUrl = await saveRentDoc(momCopyFile, "mom");
    } else if (Object.prototype.hasOwnProperty.call(body ?? {}, "momCopyUrl")) {
      const momCopyUrlVal = body?.momCopyUrl;
      if (momCopyUrlVal === "" || momCopyUrlVal === null) {
        updateData.momCopyUrl = null;
      } else if (typeof momCopyUrlVal === "string") {
        updateData.momCopyUrl = momCopyUrlVal.trim();
      }
    }

    const filesByIndex = new Map<number, File>();
    rentDocumentFiles.forEach(({ index, file }) => {
      filesByIndex.set(index, file);
    });

    // Disable document operations in edit API as requested
    const hasDocumentOperations = false;

    const updated = await prisma.$transaction(async (tx) => {
      const rent = await tx.rent.update({
        where: { id },
        data: updateData,
        select: rentSelectFields as any,
      });

      if (hasDocumentOperations) {
        const existingDocs = await tx.rentDocument.findMany({
          where: { rentId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingDocs.map((doc) => doc.id));

        const incomingById = new Map<
          number,
          { documentName: string; documentUrl: string }
        >();
        const toCreate: Array<{
          rentId: number;
          documentName: string;
          documentUrl: string;
        }> = [];
        const toDelete: number[] = [];

        for (const docMeta of rentDocumentMetadata) {
          const name = docMeta.documentName?.trim() || "";
          const file = filesByIndex.get(docMeta.index ?? -1);
          const trimmedUrl = docMeta.documentUrl?.trim();
          let finalUrl =
            trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const saved = await saveRentDoc(file, "rent-doc");
            finalUrl = saved ?? undefined;
          }

          if (docMeta.id && existingIds.has(docMeta.id)) {
            if (!name || !finalUrl) {
              toDelete.push(docMeta.id);
              continue;
            }
            incomingById.set(docMeta.id, {
              documentName: name,
              documentUrl: finalUrl,
            });
          } else {
            if (!name || !finalUrl) continue;
            toCreate.push({
              rentId: id,
              documentName: name,
              documentUrl: finalUrl,
            });
          }
        }

        const incomingIds = new Set(incomingById.keys());
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) {
            toDelete.push(existingId);
          }
        }

        if (toCreate.length > 0) {
          await tx.rentDocument.createMany({ data: toCreate });
        }

        for (const docId of incomingById.keys()) {
          const payload = incomingById.get(docId);
          if (!payload) continue;
          await tx.rentDocument.update({
            where: { id: docId },
            data: {
              documentName: payload.documentName,
              documentUrl: payload.documentUrl,
            },
          });
        }

        if (toDelete.length > 0) {
          await tx.rentDocument.deleteMany({ where: { id: { in: toDelete } } });
        }
      }

      return rent;
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if ((error as any)?.code === "P2025") {
      return NotFound("Rent not found");
    }
    console.error("Update rent error:", error);
    return ApiError("Failed to update rent");
  }
}

// DELETE - Delete rent
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    await prisma.rent.delete({
      where: { id },
    });

    return Success({ message: "Rent deleted successfully" });
  } catch (error) {
    if ((error as any)?.code === "P2025") {
      return NotFound("Rent not found");
    }
    console.error("Delete rent error:", error);
    return ApiError("Failed to delete rent");
  }
}
