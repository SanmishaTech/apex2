import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const createSchema = z.object({
  assetGroup: z.string().min(1, "Asset group name is required"),
});

// GET - List with pagination & search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { assetGroup: { contains: search } },
      ];
    }

    const result = await paginate({
      model: prisma.assetGroup,
      where,
      orderBy: { createdAt: "desc" },
      page,
      perPage,
      select: { id: true, assetGroup: true, createdAt: true, updatedAt: true }
    });

    return Success(result);
  } catch (error) {
    console.error("Get asset groups error:", error);
    return Error("Failed to fetch asset groups");
  }
}

// POST - Create with validation
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { assetGroup } = createSchema.parse(body);
    
    const created = await prisma.assetGroup.create({
      data: { assetGroup },
      select: { id: true, assetGroup: true, createdAt: true, updatedAt: true }
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('Asset group already exists', 409);
    }
    console.error("Create asset group error:", error);
    return Error("Failed to create asset group");
  }
}
