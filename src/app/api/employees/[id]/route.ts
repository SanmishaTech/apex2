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
import bcrypt from "bcryptjs";
import { ROLES } from "@/config/roles";

function labelToRoleCode(label?: string | null) {
  if (!label) return undefined as unknown as string;
  for (const [code, lbl] of Object.entries(ROLES)) {
    if (lbl === label) return code;
  }
  return label;
}
const updateSchema = z.object({
  name: z.string().min(1, "Employee name is required").optional(),
  departmentId: z.number().optional(),
  siteId: z.union([z.number(), z.array(z.number())]).optional(),
  joinDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return new Date(val);
    }),
  resignDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return new Date(val);
    }),
  // Employment Details
  designationId: z.number().optional(),
  previousWorkExperience: z.string().optional(),
  // Personal Details
  dateOfBirth: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return new Date(val);
    }),
  anniversaryDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return new Date(val);
    }),
  spouseName: z.string().optional(),
  bloodGroup: z.string().optional(),
  // Address Details
  correspondenceAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  stateId: z.number().optional(),
  cityId: z.number().optional(),
  pincode: z.string().optional(),
  // Contact Details
  mobile1: z.string().optional(),
  mobile2: z.string().optional(),
  // Emergency Contact
  emergencyContactPerson: z.string().optional(),
  emergencyContactNo: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  // Other Details
  esic: z.string().optional(),
  pf: z.string().optional(),
  panNo: z.string().optional(),
  adharNo: z.string().optional(),
  cinNo: z.string().optional(),
  // Travel/Reporting Details
  airTravelClass: z.string().optional(),
  railwayTravelClass: z.string().optional(),
  busTravelClass: z.string().optional(),
  reporting1Id: z.number().optional(),
  reporting2Id: z.number().optional(),
  reportingSiteId: z.number().optional(),
  reportingSiteAssignedDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return new Date(val);
    }),
  // Leave Details
  sickLeavesPerYear: z.number().optional(),
  paidLeavesPerYear: z.number().optional(),
  casualLeavesPerYear: z.number().optional(),
  balanceSickLeaves: z.number().optional(),
  balancePaidLeaves: z.number().optional(),
  balanceCasualLeaves: z.number().optional(),
  employeeDocuments: z
    .array(
      z.object({
        id: z.number().optional(),
        documentName: z.string().optional(),
        documentUrl: z.string().optional(),
      })
    )
    .optional(),
  // Login Details (optional)
  email: z.string().email().optional(),
  role: z.string().optional(),
  status: z.coerce.boolean().optional(),
  password: z.string().min(6).optional(),
});

// GET /api/employees/[id] - Get single employee
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        designationId: true,
        designation: { select: { id: true, designationName: true } },
        previousWorkExperience: true,
        departmentId: true,
        userId: true,
        joinDate: true,
        resignDate: true,
        dateOfBirth: true,
        anniversaryDate: true,
        spouseName: true,
        bloodGroup: true,
        correspondenceAddress: true,
        permanentAddress: true,
        stateId: true,
        cityId: true,
        pincode: true,
        mobile1: true,
        mobile2: true,
        emergencyContactPerson: true,
        emergencyContactNo: true,
        emergencyContactRelation: true,
        esic: true,
        pf: true,
        panNo: true,
        adharNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        // Travel/Reporting Details
        airTravelClass: true,
        railwayTravelClass: true,
        busTravelClass: true,
        reporting1Id: true,
        reporting2Id: true,
        reportingSiteId: true,
        reportingSiteAssignedDate: true,
        // Leave Details
        sickLeavesPerYear: true,
        paidLeavesPerYear: true,
        casualLeavesPerYear: true,
        balanceSickLeaves: true,
        balancePaidLeaves: true,
        balanceCasualLeaves: true,
        signatureImage: true,
        employeeImage: true,
        department: {
          select: {
            id: true,
            department: true,
          },
        },
        employeeDocuments: {
          select: {
            id: true,
            documentName: true,
            documentUrl: true,
          },
        },
        siteEmployees: {
          select: {
            id: true,
            siteId: true,
            assignedDate: true,
            site: {
              select: {
                id: true,
                site: true,
                shortName: true,
                company: {
                  select: {
                    id: true,
                    companyName: true,
                    shortName: true,
                  },
                },
              },
            },
          },
        },
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
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!employee) return NotFound("Employee not found");
    return Success(employee);
  } catch (error) {
    console.error("Get employee error:", error);
    return ApiError("Failed to fetch employee");
  }
}

// PATCH /api/employees/[id] - Update employee
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    const contentType = req.headers.get("content-type") || "";
    let updateData: any;
    let profilePic: File | null = null;
    let signature: File | null = null;

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
      profilePic = (form.get("profilePic") as File) || null;
      signature = (form.get("signature") as File) || null;
      // Map fields for PATCH (all optional)
      const mapped: any = {};
      const numericKeys = new Set([
        "departmentId",
        "designationId",
        "stateId",
        "cityId",
        "reporting1Id",
        "reporting2Id",
        "reportingSiteId",
        "sickLeavesPerYear",
        "paidLeavesPerYear",
        "casualLeavesPerYear",
        "balanceSickLeaves",
        "balancePaidLeaves",
        "balanceCasualLeaves",
      ]);
      for (const key of Array.from(form.keys())) {
        if (["profilePic", "signature"].includes(key)) continue;
        if (
          key === "employeeDocuments" ||
          key.startsWith("employeeDocuments[")
        ) {
          continue;
        }
        // Special handling for siteId: parse JSON string if present
        if (key === "siteId") {
          const val = form.get(key);
          if (typeof val === "string") {
            try {
              mapped[key] = JSON.parse(val);
            } catch {
              mapped[key] = val;
            }
          } else {
            mapped[key] = val;
          }
          continue;
        }
        if (numericKeys.has(key)) {
          const raw = form.get(key);
          if (raw == null || raw === "") {
            mapped[key] = undefined;
          } else if (typeof raw === "string") {
            const parsedNumber = Number(raw);
            mapped[key] = Number.isFinite(parsedNumber)
              ? parsedNumber
              : undefined;
          } else {
            mapped[key] = undefined;
          }
          continue;
        }
        mapped[key] = form.get(key);
      }
      documentsProvided = form.has("employeeDocuments");
      const documentsJson = form.get("employeeDocuments");
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
            "Failed to parse employeeDocuments metadata (PATCH)",
            err
          );
        }
      }

      form.forEach((value, key) => {
        const match = key.match(/^employeeDocuments\[(\d+)\]\[documentFile\]$/);
        if (!match) return;
        const idx = Number(match[1]);
        const fileVal = value as unknown;
        if (fileVal instanceof File) {
          documentFiles.push({ file: fileVal, index: idx });
        }
      });
      updateData = updateSchema.parse(mapped);
    } else {
      const body = await req.json();
      documentsProvided = Object.prototype.hasOwnProperty.call(
        body ?? {},
        "employeeDocuments"
      );
      updateData = updateSchema.parse(body);
      documentMetadata = Array.isArray((body as any)?.employeeDocuments)
        ? (body as any).employeeDocuments.map((doc: any, index: number) => ({
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

    const {
      employeeDocuments: employeeDocumentsPayload,
      ...updateDataWithoutDocs
    } = updateData ?? {};

    if (
      documentMetadata.length === 0 &&
      Array.isArray(employeeDocumentsPayload)
    ) {
      documentMetadata = employeeDocumentsPayload.map(
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
            typeof doc?.documentUrl === "string" ? doc.documentUrl : undefined,
          index,
        })
      );
    }

    const hasDocumentOperations =
      documentsProvided ||
      documentMetadata.length > 0 ||
      documentFiles.length > 0;

    if (
      Object.keys(updateDataWithoutDocs).length === 0 &&
      !profilePic &&
      !signature &&
      !hasDocumentOperations
    ) {
      return BadRequest("No valid fields to update");
    }

    // Handle null values for optional foreign keys
    const processedData: any = {};
    for (const [key, value] of Object.entries(updateDataWithoutDocs)) {
      if (
        key === "departmentId" ||
        key === "designationId" ||
        key === "siteId" ||
        key === "stateId" ||
        key === "cityId" ||
        key === "reporting1Id" ||
        key === "reporting2Id" ||
        key === "reportingSiteId"
      ) {
        processedData[key] = value || null;
      } else if (key === "email" || key === "role" || key === "status" || key === "password") {
        // handled separately for User update
        continue;
      } else {
        processedData[key] = value;
      }
    }

    // Handle site assignments if siteId is provided
    if (processedData.siteId !== undefined) {
      const sitesToAssign = Array.isArray(processedData.siteId)
        ? processedData.siteId
        : [processedData.siteId];

      // Get all current active siteEmployee records for this employee
      const currentSiteEmployees = await prisma.siteEmployee.findMany({
        where: {
          employeeId: id,
        },
        select: {
          id: true,
          siteId: true,
        },
      });
      const currentSiteIdToSiteEmployeeId: Record<number, number> = {};
      for (const se of currentSiteEmployees) {
        currentSiteIdToSiteEmployeeId[se.siteId] = se.id;
      }
      const currentSiteIds = currentSiteEmployees.map((se) => se.siteId);

      // Find which siteIds to update, create, and delete
      const toUpdate = sitesToAssign.filter((siteId) =>
        currentSiteIds.includes(siteId)
      );
      const toCreate = sitesToAssign.filter(
        (siteId) => !currentSiteIds.includes(siteId)
      );
      const toDelete = currentSiteIds.filter(
        (siteId) => !sitesToAssign.includes(siteId)
      );

      // Update matched
      for (const siteId of toUpdate) {
        const seId = currentSiteIdToSiteEmployeeId[siteId];
      }
      // Create new
      for (const siteId of toCreate) {
        await prisma.siteEmployee.create({
          data: {
            siteId,
            employeeId: id,
            assignedDate: new Date(),
            assignedById: auth.user.id,
          },
        });
        // Create SiteEmployeeLog record
        await prisma.siteEmployeeLog.create({
          data: {
            siteId: siteId,
            employeeId: id,
            assignedDate: new Date(),
            assignedById: auth.user.id,
          },
        });
      }
      // Remove additional
      for (const siteId of toDelete) {
        const seId = currentSiteIdToSiteEmployeeId[siteId];
        await prisma.siteEmployee.delete({
          where: { id: seId },
        });
        // Update SiteEmployeeLog record (set unassignedDate and unassignedById for the latest assignment)
        await prisma.siteEmployeeLog.updateMany({
          where: {
            siteId: siteId,
            employeeId: id,
            unassignedDate: null,
          },
          data: {
            unassignedDate: new Date(),
            unassignedById: auth.user.id,
          },
        });
      }
      // Remove siteId from processedData since it's not a field on Employee
      delete processedData.siteId;
    }

    // Save image files if provided
    async function saveImage(file: File, folder: "profiles" | "signatures") {
      if (!file || file.size === 0) return null as string | null;
      if (!file.type?.startsWith("image/")) {
        throw new Error("Only image files are allowed");
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Image file too large (max 20MB)");
      }
      const ext = path.extname(file.name) || ".png";
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), "uploads", "employees", folder);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await file.arrayBuffer())
      );
      return `/uploads/employees/${folder}/${filename}`;
    }

    async function saveDocument(file: File) {
      if (!file || file.size === 0) return null as string | null;
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Document file too large (max 20MB)");
      }
      const ext = path.extname(file.name) || path.extname(file.type) || "";
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext || ""}`;
      const dir = path.join(process.cwd(), "uploads", "employees", "documents");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await file.arrayBuffer())
      );
      return `/uploads/employees/documents/${filename}`;
    }

    if (profilePic) {
      processedData.employeeImage = await saveImage(profilePic, "profiles");
    }
    if (signature) {
      processedData.signatureImage = await saveImage(signature, "signatures");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: processedData,
        select: {
          id: true,
          employeeNumber: true,
          name: true,
          departmentId: true,
          userId: true,
          joinDate: true,
          resignDate: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              department: true,
            },
          },
          siteEmployees: {
            select: {
              id: true,
              siteId: true,
              assignedDate: true,
              site: {
                select: {
                  id: true,
                  site: true,
                },
              },
            },
          },
          employeeDocuments: {
            select: {
              id: true,
              documentName: true,
              documentUrl: true,
            },
          },
          user: {
            select: { id: true, email: true, role: true, status: true },
          },
        },
      });

      // Update linked user if any login fields provided
      const newEmail = (updateDataWithoutDocs as any)?.email as
        | string
        | undefined;
      const newRole = (updateDataWithoutDocs as any)?.role as
        | string
        | undefined;
      const newStatus = (updateDataWithoutDocs as any)?.status as
        | boolean
        | undefined;
      const newPassword = (updateDataWithoutDocs as any)?.password as
        | string
        | undefined;
      if (employee.userId && (newEmail || newRole || typeof newStatus === "boolean" || newPassword)) {
        const userUpdate: any = {};
        if (newEmail) userUpdate.email = newEmail;
        if (newRole) userUpdate.role = labelToRoleCode(newRole) as any;
        if (typeof newStatus === "boolean") userUpdate.status = newStatus;
        if (newPassword) {
          userUpdate.passwordHash = await bcrypt.hash(newPassword, 10);
        }
        await tx.user.update({
          where: { id: employee.userId },
          data: userUpdate,
        });
      }

      if (
        documentsProvided ||
        documentMetadata.length > 0 ||
        documentFiles.length > 0
      ) {
        const incomingById = new Map<
          number,
          { documentName?: string; documentUrl?: string }
        >();
        const createPayload: Array<{
          employeeId: number;
          documentName: string;
          documentUrl: string;
        }> = [];
        const toDeleteIds: number[] = [];

        const filesByIndex = new Map<number, File>();
        documentFiles.forEach((entry) => {
          filesByIndex.set(entry.index, entry.file);
        });

        const existingDocs = await tx.employeeDocument.findMany({
          where: { employeeId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingDocs.map((doc) => doc.id));

        for (const docMeta of documentMetadata) {
          const docName = (docMeta.documentName || "").trim();
          const file = filesByIndex.get(docMeta.index ?? -1);
          const trimmedUrl = docMeta.documentUrl?.trim();
          let finalUrl =
            trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
          if (file) {
            const uploadedUrl = await saveDocument(file);
            finalUrl = uploadedUrl ?? undefined;
          }
          if (docMeta.id && existingIds.has(docMeta.id)) {
            if (!docName || !finalUrl) {
              toDeleteIds.push(docMeta.id);
              continue;
            }
            incomingById.set(docMeta.id, {
              documentName: docName,
              documentUrl: finalUrl,
            });
          } else {
            if (!docName || !finalUrl) continue;
            createPayload.push({
              employeeId: id,
              documentName: docName,
              documentUrl: finalUrl,
            });
          }
        }

        const incomingIds = new Set(incomingById.keys());
        for (const existingId of existingIds) {
          if (!incomingIds.has(existingId)) {
            toDeleteIds.push(existingId);
          }
        }

        if (createPayload.length > 0) {
          await tx.employeeDocument.createMany({ data: createPayload });
        }

        for (const docId of incomingById.keys()) {
          const payload = incomingById.get(docId);
          if (!payload) continue;
          await tx.employeeDocument.update({
            where: { id: docId },
            data: {
              documentName: payload.documentName,
              documentUrl: payload.documentUrl,
            },
          });
        }

        if (toDeleteIds.length > 0) {
          await tx.employeeDocument.deleteMany({
            where: { id: { in: toDeleteIds } },
          });
        }
      }

      return employee;
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Employee not found");
    console.error("Update employee error:", error);
    return ApiError("Failed to update employee");
  }
}

// DELETE /api/employees/[id] - Delete employee
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    await prisma.employee.delete({ where: { id } });

    return Success({ message: "Employee deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Employee not found");
    console.error("Delete employee error:", error);
    return ApiError("Failed to delete employee");
  }
}
