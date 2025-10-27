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
const updateSchema = z.object({
  name: z.string().min(1, "Employee name is required").optional(),
  departmentId: z.number().optional(),
  siteId: z.union([z.number(), z.array(z.number())]).optional(),
  resignDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return new Date(val);
    }),
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
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  stateId: z.number().optional(),
  cityId: z.number().optional(),
  pincode: z.string().optional(),
  // Contact Details
  mobile1: z.string().optional(),
  mobile2: z.string().optional(),
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
        name: true,
        departmentId: true,
        resignDate: true,
        dateOfBirth: true,
        anniversaryDate: true,
        spouseName: true,
        bloodGroup: true,
        addressLine1: true,
        addressLine2: true,
        stateId: true,
        cityId: true,
        pincode: true,
        mobile1: true,
        mobile2: true,
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

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      profilePic = (form.get("profilePic") as File) || null;
      signature = (form.get("signature") as File) || null;
      // Map fields for PATCH (all optional)
      const mapped: any = {};
      for (const key of Array.from(form.keys())) {
        if (["profilePic", "signature"].includes(key)) continue;
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
        mapped[key] = form.get(key);
      }
      updateData = updateSchema.parse(mapped);
    } else {
      const body = await req.json();
      updateData = updateSchema.parse(body);
    }

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    // Handle null values for optional foreign keys
    const processedData: any = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (
        key === "departmentId" ||
        key === "siteId" ||
        key === "stateId" ||
        key === "cityId" ||
        key === "reporting1Id" ||
        key === "reporting2Id" ||
        key === "reportingSiteId"
      ) {
        processedData[key] = value || null;
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

    if (profilePic) {
      processedData.employeeImage = await saveImage(profilePic, "profiles");
    }
    if (signature) {
      processedData.signatureImage = await saveImage(signature, "signatures");
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: processedData,
      select: {
        id: true,
        name: true,
        departmentId: true,
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
      },
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
