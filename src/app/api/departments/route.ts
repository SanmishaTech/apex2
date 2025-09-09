import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  department: z.string().min(1, "Department name is required"),
});

// GET /api/departments?search=&page=1&perPage=10&sort=department&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "department") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    type DeptWhere = { department?: { contains: string } };
    const where: DeptWhere = {};
    if (search) {
      where.department = { contains: search };
    }

    const sortableFields = new Set(["department", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { department: "asc" };

    const result = await paginate({
      model: prisma.department,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get departments error:", error);
    return Error("Failed to fetch departments");
  }
}

// POST /api/departments - Create new department
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { department } = createSchema.parse(body);

    const created = await prisma.department.create({
      data: { department },
      select: {
        id: true,
        department: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return Error("Department already exists", 409);
    }
    console.error("Create department error:", error);
    return Error("Failed to create department");
  }
}
