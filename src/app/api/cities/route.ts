import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  city: z.string().min(1, "City name is required"),
  stateId: z.number().optional().nullable(),
});

// GET /api/cities?search=&page=1&perPage=10&sort=city&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "city") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    // Build dynamic filter
    type CityWhere = {
      city?: { contains: string };
      stateId?: number;
    };
    const where: CityWhere = {};
    
    if (search) {
      where.city = { contains: search };
    }
    
    const stateIdParam = searchParams.get("stateId");
    if (stateIdParam && !isNaN(Number(stateIdParam))) {
      where.stateId = Number(stateIdParam);
    }

    // Allow listed sortable fields only
    const sortableFields = new Set(["city", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) 
      ? { [sort]: order } 
      : { city: "asc" };

    const result = await paginate({
      model: prisma.city as any,
      where,
      orderBy,
      page,
      perPage,
      select: { 
        id: true, 
        city: true, 
        createdAt: true,
        updatedAt: true,
        stateId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        }
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get cities error:", error);
    return Error("Failed to fetch cities");
  }
}

// POST /api/cities - Create new city
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { city, stateId } = createSchema.parse(body);
    
    const created = await prisma.city.create({
      data: { 
        city,
        stateId 
      },
      select: { 
        id: true, 
        city: true, 
        createdAt: true,
        stateId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        }
      }
    });
    
    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('City already exists', 409);
    }
    console.error("Create city error:", error);
    return Error("Failed to create city");
  }
}
