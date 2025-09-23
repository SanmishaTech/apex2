import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  rentType: z.string().min(1, "Rent type is required"),
});

// GET /api/rent-types?search=&page=1&perPage=10&sort=rentType&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "rentType") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    type RentTypeWhere = { rentType?: { contains: string } };
    const where: RentTypeWhere = {};
    if (search) {
      where.rentType = { contains: search };
    }

    const sortableFields = new Set(["rentType", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { rentType: "asc" };

    const result = await paginate({
      model: prisma.rentType,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        rentType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get rent types error:", error);
    return Error("Failed to fetch rent types");
  }
}

// POST /api/rent-types - Create new rent type
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { rentType } = createSchema.parse(body);

    const created = await prisma.rentType.create({
      data: { rentType },
      select: {
        id: true,
        rentType: true,
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
      return Error("Rent type already exists", 409);
    }
    console.error("Create rent type error:", error);
    return Error("Failed to create rent type");
  }
}
