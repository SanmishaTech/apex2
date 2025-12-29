import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  designationName: z.string().min(1, "Designation name is required"),
});

// GET /api/designations - List with pagination & search (mirrors states)
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "designationName") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    type Where = { OR?: { designationName?: { contains: string } }[] };
    const where: Where = {};
    if (search) {
      where.OR = [{ designationName: { contains: search } }];
    }

    const sortableFields = new Set(["designationName", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { designationName: "asc" };

    const result = await paginate({
      model: prisma.designation as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        designationName: true,
        createdAt: true,
        updatedAt: true,
      },
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
    console.error("Get designations error:", error);
    return ApiError("Failed to fetch designations");
  }
}

// POST /api/designations - Create new designation
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { designationName } = createSchema.parse(body);

    const created = await prisma.designation.create({
      data: { designationName },
      select: { id: true, designationName: true, createdAt: true },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return ApiError("Designation already exists", 409);
    }
    console.error("Create designation error:", error);
    return ApiError("Failed to create designation");
  }
}
