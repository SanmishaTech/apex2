import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1, "Employee name is required").optional(),
  departmentId: z.number().optional(),
  siteId: z.number().optional(),
  resignDate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
  // Personal Details
  dateOfBirth: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
  anniversaryDate: z.string().optional().transform((val) => {
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
  reportingSiteAssignedDate: z.string().optional().transform((val) => {
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
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
        siteId: true,
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
        department: {
          select: {
            id: true,
            department: true,
          },
        },
        site: {
          select: {
            id: true,
            site: true,
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
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    // Handle null values for optional foreign keys
    const processedData: any = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'departmentId' || key === 'siteId' || key === 'stateId' || key === 'cityId' || key === 'reporting1Id' || key === 'reporting2Id' || key === 'reportingSiteId') {
        processedData[key] = value || null;
      } else {
        processedData[key] = value;
      }
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: processedData,
      select: {
        id: true,
        name: true,
        departmentId: true,
        siteId: true,
        resignDate: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            department: true,
          },
        },
        site: {
          select: {
            id: true,
            site: true,
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
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
