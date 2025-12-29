import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest as ApiBadRequest,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Utility to coerce possibly-empty string to null
function nil(v: any) {
  return v == null || v === "" ? null : v;
}

// Utility to coerce wage-like inputs to a decimal string or null
function wageOrNull(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined")
    return null;
  // accept integers or decimals
  const dec = /^\d+(?:\.\d+)?$/;
  return dec.test(s) ? s : null;
}

// Save uploaded file to /uploads/manpower and return URL
async function saveDoc(file: File | null, subname: string) {
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
  const dir = path.join(process.cwd(), "uploads", "manpower");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    Buffer.from(await file.arrayBuffer())
  );
  return `/uploads/manpower/${filename}`;
}

// GET /api/manpower?search=&page=1&perPage=10&sort=firstName&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(searchParams.get("perPage")) || 10)
  );
  const search = (searchParams.get("search") || "").trim();
  const sort = searchParams.get("sort") || "firstName";
  const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
    | "asc"
    | "desc";
  const supplierId = searchParams.get("supplierId");
  const isAssigned = searchParams.get("isAssigned");
  const currentSiteId = searchParams.get("currentSiteId");

  const where: any = {};

  // Text search
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { mobileNumber: { contains: search } },
      { panNumber: { contains: search } },
      { aadharNo: { contains: search } },
      { manpowerSupplier: { supplierName: { contains: search } } },
    ];
  }

  // Filter by supplier
  if (supplierId) {
    where.supplierId = parseInt(supplierId);
  }

  // Filter by assignment status
  if (isAssigned !== null && isAssigned !== undefined) {
    where.isAssigned = isAssigned === "true";
  }

  // Filter by current site
  if (currentSiteId) {
    where.currentSiteId = parseInt(currentSiteId);
  }

  const sortable = new Set([
    "firstName",
    "lastName",
    "mobileNumber",
    "wage",
    "createdAt",
  ]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort)
    ? { [sort]: order }
    : { firstName: "asc" };

  const result = await paginate({
    model: prisma.manpower as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      supplierId: true,
      manpowerSupplier: { select: { id: true, supplierName: true } },
      dateOfBirth: true,
      address: true,
      location: true,
      mobileNumber: true,
      wage: true,
      bank: true,
      branch: true,
      accountNumber: true,
      ifscCode: true,
      pfNo: true,
      esicNo: true,
      unaNo: true,
      panNumber: true,
      aadharNo: true,
      voterIdNo: true,
      drivingLicenceNo: true,
      bankDetails: true,
      watch: true,
      // Assignment tracking fields
      category: true,
      skillSet: true,
      minWage: true,
      hours: true,
      esic: true,
      pf: true,
      pt: true,
      hra: true,
      mlwf: true,
      isAssigned: true,
      currentSiteId: true,
      assignedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/manpower - supports multipart for document uploads
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let files: Record<string, File | null> = {};
    let documentFiles: Array<{ file: File; index: number }> = [];
    let documentMetadata: Array<{
      id?: number;
      documentName: string;
      documentUrl?: string;
      index: number;
    }> = [];
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const get = (k: string) => form.get(k) as string | null;
      files = {
        pan: form.get("panDocument") as File,
        aadhar: form.get("aadharDocument") as File,
        voter: form.get("voterIdDocument") as File,
        dl: form.get("drivingLicenceDocument") as File,
        bank: form.get("bankDetailsDocument") as File,
      };
      body = {
        firstName: get("firstName"),
        middleName: get("middleName"),
        lastName: get("lastName"),
        supplierId: get("supplierId"),
        category: get("category"),
        skillSet: get("skillSet"),
        dateOfBirth: get("dateOfBirth"),
        address: get("address"),
        location: get("location"),
        mobileNumber: get("mobileNumber"),
        wage: get("wage"),
        bank: get("bank"),
        branch: get("branch"),
        accountNumber: get("accountNumber"),
        ifscCode: get("ifscCode"),
        pfNo: get("pfNo"),
        esicNo: get("esicNo"),
        unaNo: get("unaNo"),
        panNumber: get("panNumber"),
        aadharNo: get("aadharNo"),
        voterIdNo: get("voterIdNo"),
        drivingLicenceNo: get("drivingLicenceNo"),
        bankDetails: get("bankDetails"),
        watch: get("watch"),
      };

      const documentsJson = form.get("manpowerDocuments");
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
                documentName: String(doc.documentName || ""),
                documentUrl:
                  typeof doc.documentUrl === "string"
                    ? doc.documentUrl
                    : undefined,
                index,
              }));
          }
        } catch (err) {
          console.warn(
            "Failed to parse manpowerDocuments metadata (POST)",
            err
          );
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^manpowerDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) {
          documentFiles.push({ file: fileVal, index: idx });
        }
      });
    } else {
      body = await req.json();
      documentMetadata = Array.isArray((body as any)?.manpowerDocuments)
        ? (body as any).manpowerDocuments.map((doc: any, index: number) => ({
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

    if (!body.firstName) return ApiError("First name is required", 400);
    const supplierIdNum = Number(body.supplierId);
    if (!supplierIdNum || Number.isNaN(supplierIdNum))
      return ApiError("Valid manpower supplier is required", 400);

    // Save any documents
    let panDocumentUrl: string | null = null;
    let aadharDocumentUrl: string | null = null;
    let voterIdDocumentUrl: string | null = null;
    let drivingLicenceDocumentUrl: string | null = null;
    let bankDetailsDocumentUrl: string | null = null;
    try {
      if (files.pan) panDocumentUrl = await saveDoc(files.pan, "pan");
      if (files.aadhar)
        aadharDocumentUrl = await saveDoc(files.aadhar, "aadhar");
      if (files.voter) voterIdDocumentUrl = await saveDoc(files.voter, "voter");
      if (files.dl) drivingLicenceDocumentUrl = await saveDoc(files.dl, "dl");
      if (files.bank)
        bankDetailsDocumentUrl = await saveDoc(files.bank, "bank");
    } catch (e: any) {
      return ApiError(e?.message || "Invalid document upload", 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const manpower = await tx.manpower.create({
        data: {
          firstName: String(body.firstName).trim(),
          middleName: nil(body.middleName) as any,
          lastName: nil(body.lastName) as any,
          supplierId: supplierIdNum,
          category: nil(body.category) as any,
          skillSet: nil(body.skillSet) as any,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          address: nil(body.address) as any,
          location: nil(body.location) as any,
          mobileNumber: nil(body.mobileNumber) as any,
          wage: wageOrNull(body.wage) as any,
          bank: nil(body.bank) as any,
          branch: nil(body.branch) as any,
          accountNumber: nil(body.accountNumber) as any,
          ifscCode: nil(body.ifscCode) as any,
          pfNo: nil(body.pfNo) as any,
          esicNo: nil(body.esicNo) as any,
          unaNo: nil(body.unaNo) as any,
          panNumber: nil(body.panNumber) as any,
          aadharNo: nil(body.aadharNo) as any,
          voterIdNo: nil(body.voterIdNo) as any,
          drivingLicenceNo: nil(body.drivingLicenceNo) as any,
          bankDetails: nil(body.bankDetails) as any,
          panDocumentUrl,
          aadharDocumentUrl,
          voterIdDocumentUrl,
          drivingLicenceDocumentUrl,
          bankDetailsDocumentUrl,
          watch: body.watch === true || body.watch === "true",
        },
        select: { id: true },
      });

      if (documentMetadata.length > 0 || documentFiles.length > 0) {
        const filesByIndex = new Map<number, File>();
        documentFiles.forEach((entry) => {
          filesByIndex.set(entry.index, entry.file);
        });

        const createPayload: Array<{
          manpowerId: number;
          documentName: string;
          documentUrl: string;
        }> = [];

        for (const docMeta of documentMetadata) {
          const name = (docMeta.documentName || "").trim();
          const file = filesByIndex.get(docMeta.index ?? -1);
          const trimmedUrl = docMeta.documentUrl?.trim();
          let finalUrl =
            trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const saved = await saveDoc(file, "manpower-doc");
            finalUrl = saved ?? undefined;
          }
          if (!name || !finalUrl) continue;
          createPayload.push({
            manpowerId: manpower.id,
            documentName: name,
            documentUrl: finalUrl,
          });
        }

        if (createPayload.length > 0) {
          await tx.manpowerDocument.createMany({ data: createPayload });
        }
      }

      return manpower;
    });
    return Success(created, 201);
  } catch (e) {
    return ApiError("Failed to create manpower");
  }
}

// PATCH /api/manpower
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let files: Record<string, File | null> = {};
    let documentFiles: Array<{ file: File; index: number }> = [];
    let documentMetadata: Array<{
      id?: number;
      documentName?: string;
      documentUrl?: string;
      index: number;
    }> = [];
    let documentsProvided = false;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const get = (k: string) => form.get(k) as string | null;
      files = {
        pan: form.get("panDocument") as File,
        aadhar: form.get("aadharDocument") as File,
        voter: form.get("voterIdDocument") as File,
        dl: form.get("drivingLicenceDocument") as File,
        bank: form.get("bankDetailsDocument") as File,
      };
      body = {
        id: get("id"),
        firstName: get("firstName"),
        middleName: get("middleName"),
        lastName: get("lastName"),
        supplierId: get("supplierId"),
        category: get("category"),
        skillSet: get("skillSet"),
        dateOfBirth: get("dateOfBirth"),
        address: get("address"),
        location: get("location"),
        mobileNumber: get("mobileNumber"),
        wage: get("wage"),
        bank: get("bank"),
        branch: get("branch"),
        accountNumber: get("accountNumber"),
        ifscCode: get("ifscCode"),
        pfNo: get("pfNo"),
        esicNo: get("esicNo"),
        unaNo: get("unaNo"),
        panNumber: get("panNumber"),
        aadharNo: get("aadharNo"),
        voterIdNo: get("voterIdNo"),
        drivingLicenceNo: get("drivingLicenceNo"),
        bankDetails: get("bankDetails"),
        watch: get("watch"),
      };

      documentsProvided = form.has("manpowerDocuments");
      const documentsJson = form.get("manpowerDocuments");
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
        } catch (err) {
          console.warn(
            "Failed to parse manpowerDocuments metadata (PATCH)",
            err
          );
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^manpowerDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) {
          documentFiles.push({ file: fileVal, index: idx });
        }
      });
    } else {
      body = await req.json();
      documentsProvided = Object.prototype.hasOwnProperty.call(
        body ?? {},
        "manpowerDocuments"
      );
      documentMetadata = Array.isArray((body as any)?.manpowerDocuments)
        ? (body as any).manpowerDocuments.map((doc: any, index: number) => ({
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
          }))
        : [];
    }
    const id = Number(body.id);
    if (!id || Number.isNaN(id)) return ApiError("id is required", 400);

    const data: Record<string, any> = {};
    const set = (k: string, v: any) => {
      if (v !== undefined)
        data[k] = v === "" ? null : typeof v === "string" ? v.trim() : v;
    };
    set("firstName", body.firstName);
    set("middleName", body.middleName);
    set("lastName", body.lastName);
    if (body.supplierId !== undefined)
      data.supplierId = body.supplierId ? Number(body.supplierId) : null;
    set("category", body.category);
    set("skillSet", body.skillSet);
    if (body.dateOfBirth !== undefined)
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    set("address", body.address);
    set("location", body.location);
    set("mobileNumber", body.mobileNumber);
    if (body.wage !== undefined) data.wage = wageOrNull(body.wage) as any;
    set("bank", body.bank);
    set("branch", body.branch);
    set("accountNumber", body.accountNumber);
    set("ifscCode", body.ifscCode);
    set("pfNo", body.pfNo);
    set("esicNo", body.esicNo);
    set("unaNo", body.unaNo);
    set("panNumber", body.panNumber);
    set("aadharNo", body.aadharNo);
    set("voterIdNo", body.voterIdNo);
    set("drivingLicenceNo", body.drivingLicenceNo);
    set("bankDetails", body.bankDetails);
    if (body.watch !== undefined)
      data.watch = body.watch === true || body.watch === "true";

    // Save doc files if any
    try {
      if (files.pan) data.panDocumentUrl = await saveDoc(files.pan, "pan");
      if (files.aadhar)
        data.aadharDocumentUrl = await saveDoc(files.aadhar, "aadhar");
      if (files.voter)
        data.voterIdDocumentUrl = await saveDoc(files.voter, "voter");
      if (files.dl)
        data.drivingLicenceDocumentUrl = await saveDoc(files.dl, "dl");
      if (files.bank)
        data.bankDetailsDocumentUrl = await saveDoc(files.bank, "bank");
    } catch (e: any) {
      return ApiError(e?.message || "Invalid document upload", 400);
    }

    const hasDocumentOperations =
      documentsProvided ||
      documentMetadata.length > 0 ||
      documentFiles.length > 0;

    if (!Object.keys(data).length && !hasDocumentOperations)
      return ApiError("Nothing to update", 400);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const manpower = await tx.manpower.update({
          where: { id },
          data,
          select: { id: true },
        });

        if (hasDocumentOperations) {
          const filesByIndex = new Map<number, File>();
          documentFiles.forEach((entry) => {
            filesByIndex.set(entry.index, entry.file);
          });

          const incomingById = new Map<
            number,
            { documentName?: string; documentUrl?: string }
          >();
          const toCreate: Array<{
            manpowerId: number;
            documentName: string;
            documentUrl: string;
          }> = [];
          const toDelete: number[] = [];

          const existingDocs = await tx.manpowerDocument.findMany({
            where: { manpowerId: id },
            select: { id: true },
          });
          const existingIds = new Set(existingDocs.map((doc) => doc.id));

          for (const docMeta of documentMetadata) {
            const name = docMeta.documentName?.trim() || "";
            const file = filesByIndex.get(docMeta.index ?? -1);
            const trimmedUrl = docMeta.documentUrl?.trim();
            let finalUrl =
              trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
            if (file) {
              const uploaded = await saveDoc(file, "manpower-doc");
              finalUrl = uploaded ?? undefined;
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
                manpowerId: id,
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
            await tx.manpowerDocument.createMany({ data: toCreate });
          }

          for (const docId of incomingById.keys()) {
            const payload = incomingById.get(docId);
            if (!payload) continue;
            await tx.manpowerDocument.update({
              where: { id: docId },
              data: {
                documentName: payload.documentName,
                documentUrl: payload.documentUrl,
              },
            });
          }

          if (toDelete.length > 0) {
            await tx.manpowerDocument.deleteMany({
              where: { id: { in: toDelete } },
            });
          }
        }

        return manpower;
      });
      return Success(updated);
    } catch (e: any) {
      if (e?.code === "P2025")
        return ApiError("Manpower record not found", 404);
      return ApiError("Failed to update manpower");
    }
  } catch (e) {
    return ApiError("Failed to update manpower");
  }
}
