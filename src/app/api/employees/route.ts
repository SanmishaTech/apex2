import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Employee name is required"),
  departmentId: z.number().optional(),
  siteId: z.number().optional(),
  resignDate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return new Date(val);
  }),
});

// GET /api/employees?search=&page=1&perPage=10&sort=name&order=asc&department=&site=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const departmentFilter = searchParams.get("department") || "";
    const siteFilter = searchParams.get("site") || "";
    const sort = (searchParams.get("sort") || "name") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    type EmployeeWhere = {
      OR?: Array<{ name?: { contains: string } }>;
      departmentId?: number;
      siteId?: number;
    };
    
    const where: EmployeeWhere = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
      ];
    }
    
    if (departmentFilter) {
      const deptId = parseInt(departmentFilter);
      if (!isNaN(deptId)) {
        where.departmentId = deptId;
      }
    }
    
    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        where.siteId = siteId;
      }
    }

    const sortableFields = new Set(["name", "createdAt", "resignDate"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { name: "asc" };

    const result = await paginate({
      model: prisma.employee,
      where,
      orderBy,
      page,
      perPage,
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

    return Success(result);
  } catch (error) {
    console.error("Get employees error:", error);
    return Error("Failed to fetch employees");
  }
}

// POST /api/employees - Create new employee
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { name, departmentId, siteId, resignDate } = createSchema.parse(body);

    const created = await prisma.employee.create({
      data: { 
        name, 
        departmentId: departmentId || null,
        siteId: siteId || null,
        resignDate: resignDate || null,
      },
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

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create employee error:", error);
    return Error("Failed to create employee");
  }
}
