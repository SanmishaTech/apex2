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
import {
  validatePAN,
  validateTAN,
  validateCIN,
  validateGST,
} from "@/lib/tax-validation";

const updateSchema = z.object({
  companyName: z.string().min(1, "Company name is required").optional(),
  shortName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  closed: z.boolean().optional(),
  panNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validatePAN(val), {
      message:
        "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)",
    }),
  gstNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateGST(val), {
      message: "Invalid GST format. Format: 99AAAAA9999A9A9",
    }),
  tanNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateTAN(val), {
      message:
        "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)",
    }),
  cinNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateCIN(val), {
      message: "Invalid CIN format. Format: U99999AA9999AAA999999",
    }),
});

// GET /api/companies/[id] - Get single company
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid company ID");

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        shortName: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        logoUrl: true,
        closed: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        state: {
          select: {
            id: true,
            state: true,
          },
        },
        city: {
          select: {
            id: true,
            city: true,
          },
        },
        companyDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
      },
    });

    if (!company) return NotFound("Company not found");
    return Success(company);
  } catch (error) {
    console.error("Get company error:", error);
    return ApiError("Failed to fetch company");
  }
}

// PATCH /api/companies/[id] - Update company
async function saveCompanyDoc(file: File | null, subname: string) {
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
  const filename = `${Date.now()}-company-doc-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads", "companies");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    Buffer.from(await file.arrayBuffer())
  );
  return `/uploads/companies/${filename}`;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid company ID");

    const contentType = req.headers.get("content-type") || "";
    let companyData: Record<string, unknown>;
    let logoFile: File | null = null;
    let companyDocumentFiles: Array<{ index: number; file: File }> = [];
    let documentMetadata: Array<{
      id?: number;
      documentName?: string;
      documentUrl?: string;
      index: number;
    }> = [];
    let documentsProvided = false;

    // Handle multipart form data for file uploads
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      logoFile = form.get("logo") as File;

      // Extract other form data
      companyData = {
        companyName: form.get("companyName") || undefined,
        shortName: form.get("shortName") || null,
        contactPerson: form.get("contactPerson") || null,
        contactNo: form.get("contactNo") || null,
        addressLine1: form.get("addressLine1") || null,
        addressLine2: form.get("addressLine2") || null,
        stateId: form.get("stateId") ? Number(form.get("stateId")) : null,
        cityId: form.get("cityId") ? Number(form.get("cityId")) : null,
        pinCode: form.get("pinCode") || null,
        closed: form.get("closed") === "true",
        panNo: form.get("panNo") || null,
        gstNo: form.get("gstNo") || null,
        tanNo: form.get("tanNo") || null,
        cinNo: form.get("cinNo") || null,
      };

      // Documents payload
      documentsProvided = form.has("companyDocuments");
      const documentsJson = form.get("companyDocuments");
      if (typeof documentsJson === "string" && documentsJson.trim() !== "") {
        try {
          const parsed = JSON.parse(documentsJson);
          if (Array.isArray(parsed)) {
            documentMetadata = parsed
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
        } catch (e) {
          console.warn("Failed to parse companyDocuments metadata (PATCH)", e);
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^companyDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File)
          companyDocumentFiles.push({ index: idx, file: fileVal });
      });

      // Remove undefined values for partial updates
      Object.keys(companyData).forEach((key) => {
        if (companyData[key] === undefined) {
          delete companyData[key];
        }
      });
    } else {
      // Handle JSON data
      companyData = await req.json();
      documentsProvided = Object.prototype.hasOwnProperty.call(
        companyData ?? {},
        "companyDocuments"
      );
      documentMetadata = Array.isArray((companyData as any)?.companyDocuments)
        ? (companyData as any).companyDocuments.map(
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
          )
        : [];
    }

    // Handle logo upload if present
    if (logoFile && logoFile.size > 0) {
      // Validate file type and size
      if (!logoFile.type?.startsWith("image/")) {
        return ApiError("Logo must be an image file", 415);
      }
      if (logoFile.size > 20 * 1024 * 1024) {
        return ApiError("Logo file too large (max 20MB)", 413);
      }

      // Get current company to potentially delete old logo
      const currentCompany = await prisma.company.findUnique({
        where: { id },
        select: { logoUrl: true },
      });

      // Generate unique filename and save
      const ext = path.extname(logoFile.name) || ".png";
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), "uploads", "companies");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await logoFile.arrayBuffer())
      );
      companyData.logoUrl = `/uploads/companies/${filename}`;

      // Delete old logo file if it exists
      if (
        currentCompany?.logoUrl &&
        currentCompany.logoUrl.startsWith("/uploads/companies/")
      ) {
        const oldPath = path.join(process.cwd(), currentCompany.logoUrl);
        try {
          await fs.unlink(oldPath);
        } catch (error) {
          console.warn("Could not delete old logo file:", error);
        }
      }
    }

    const updateData = updateSchema.parse(companyData);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const hasDocumentOperations =
      documentsProvided ||
      documentMetadata.length > 0 ||
      companyDocumentFiles.length > 0;

    const updated = await prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id },
        data: updateData,
        select: { id: true },
      });

      if (hasDocumentOperations) {
        const filesByIndex = new Map<number, File>();
        companyDocumentFiles.forEach(({ index, file }) =>
          filesByIndex.set(index, file)
        );

        const existingDocs = await tx.companyDocument.findMany({
          where: { companyId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingDocs.map((d) => d.id));

        const incomingById = new Map<
          number,
          { documentName: string; documentUrl: string }
        >();
        const toCreate: Array<{
          companyId: number;
          documentName: string;
          documentUrl: string;
        }> = [];
        const toDelete: number[] = [];

        for (const docMeta of documentMetadata) {
          const name = docMeta.documentName?.trim() || "";
          const file = filesByIndex.get(docMeta.index ?? -1);
          const trimmedUrl = docMeta.documentUrl?.trim();
          let finalUrl =
            trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const saved = await saveCompanyDoc(file, "doc");
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
              companyId: id,
              documentName: name,
              documentUrl: finalUrl,
            });
          }
        }

        const incomingIds = new Set(incomingById.keys());
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) toDelete.push(existingId);
        }

        if (toCreate.length > 0) {
          await tx.companyDocument.createMany({ data: toCreate });
        }
        for (const docId of incomingById.keys()) {
          const payload = incomingById.get(docId);
          if (!payload) continue;
          await tx.companyDocument.update({
            where: { id: docId },
            data: {
              documentName: payload.documentName,
              documentUrl: payload.documentUrl,
            },
          });
        }
        if (toDelete.length > 0) {
          await tx.companyDocument.deleteMany({
            where: { id: { in: toDelete } },
          });
        }
      }

      return company;
    });

    return Success(updated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2025") return NotFound("Company not found");
      if (error.code === "P2002") {
        return ApiError("Company with this name already exists", 409);
      }
    }
    console.error("Update company error:", error);
    return ApiError("Failed to update company");
  }
}

// DELETE /api/companies/[id] - Delete company
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid company ID");

    // Get company to potentially delete logo file
    const company = await prisma.company.findUnique({
      where: { id },
      select: { logoUrl: true },
    });

    if (!company) return NotFound("Company not found");

    await prisma.company.delete({
      where: { id },
    });

    // Delete logo file if it exists
    if (company.logoUrl && company.logoUrl.startsWith("/uploads/companies/")) {
      const logoPath = path.join(process.cwd(), company.logoUrl);
      try {
        await fs.unlink(logoPath);
      } catch (error) {
        console.warn("Could not delete logo file:", error);
      }
    }

    return Success({ message: "Company deleted successfully" });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    )
      return NotFound("Company not found");
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return ApiError(
        "Cannot delete this company because it is in use by other records. Please remove those links and try again.",
        409
      );
    }
    console.error("Delete company error:", error);
    return ApiError("Failed to delete company");
  }
}
