import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
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
});

// GET /api/employees/[id] - Get single employee
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    const employee = await prisma.employee.findUnique({
      where: { id },
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

    if (!employee) return NotFound("Employee not found");
    return Success(employee);
  } catch (error) {
    console.error("Get employee error:", error);
    return Error("Failed to fetch employee");
  }
}

// PATCH /api/employees/[id] - Update employee
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    // Handle null values for optional foreign keys
    const processedData: any = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'departmentId' || key === 'siteId') {
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
    return Error("Failed to update employee");
  }
}

// DELETE /api/employees/[id] - Delete employee
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid employee ID");

    await prisma.employee.delete({ where: { id } });

    return Success({ message: "Employee deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Employee not found");
    console.error("Delete employee error:", error);
    return Error("Failed to delete employee");
  }
}
