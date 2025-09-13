import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  state: z.string().min(1, "State name is required"),
  status: z.boolean().default(true),
});

// GET /api/states - List states with pagination & search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const statusParam = searchParams.get("status");
    const sort = (searchParams.get("sort") || "state") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    // Build dynamic filter
    type StateWhere = {
      OR?: { state?: { contains: string } }[];
      status?: boolean;
    };
    const where: StateWhere = {};
    if (search) {
      where.OR = [
        { state: { contains: search } },
      ];
    }
    if (statusParam === "true" || statusParam === "false") where.status = statusParam === "true";

    // Allow listed sortable fields only
    const sortableFields = new Set(["state", "status", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { state: "asc" };

    const result = await paginate({
      model: prisma.state,
      where,
      orderBy,
      page,
      perPage,
      select: { 
        id: true, 
        state: true, 
        status: true, 
        createdAt: true,
        updatedAt: true
      },
    });

    // Wrap pagination metadata for consistency with expected frontend structure
    const response = {
      data: result.data,
      meta: {
        page: result.page,
        perPage: result.perPage, 
        total: result.total,
        totalPages: result.totalPages
      }
    };

    return Success(response);
  } catch (error) {
    console.error("Get states error:", error);
    return Error("Failed to fetch states");
  }
}

// POST /api/states - Create new state
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { state, status } = createSchema.parse(body);
    
    const created = await prisma.state.create({
      data: { 
        state, 
        status 
      },
      select: { 
        id: true, 
        state: true, 
        status: true, 
        createdAt: true 
      }
    });
    
    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('State already exists', 409);
    }
    console.error("Create state error:", error);
    return Error("Failed to create state");
  }
}
