import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  zoneName: z.string().min(1, "Zone name is required"),
});

// GET /api/zones - List with pagination & search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "zoneName") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    type Where = { OR?: { zoneName?: { contains: string } }[] };
    const where: Where = {};
    if (search) {
      where.OR = [{ zoneName: { contains: search } }];
    }

    const sortableFields = new Set(["zoneName", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { zoneName: "asc" };

    const result = await paginate({
      model: prisma.zone as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        zoneName: true,
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
    console.error("Get zones error:", error);
    return ApiError("Failed to fetch zones");
  }
}

// POST /api/zones - Create new zone
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { zoneName } = createSchema.parse(body);

    const created = await prisma.zone.create({
      data: { zoneName },
      select: { id: true, zoneName: true, createdAt: true },
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return ApiError("Zone already exists", 409);
    }
    console.error("Create zone error:", error);
    return ApiError("Failed to create zone");
  }
}
