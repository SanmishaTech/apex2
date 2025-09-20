import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const createSchema = z.object({
  paymentTerm: z.string().min(1, "Payment term is required"),
  description: z.string().optional().nullable(),
});

// GET /api/payment-terms - List Payment Terms with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "paymentTerm") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type PaymentTermWhere = {
    OR?: { 
      paymentTerm?: { contains: string }; 
      description?: { contains: string }; 
    }[];
  };
  const where: PaymentTermWhere = {};
  if (search) {
    where.OR = [
      { paymentTerm: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const sortableFields = new Set(["paymentTerm", "description", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { paymentTerm: "asc" };

  const result = await paginate({
    model: prisma.paymentTerm,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      paymentTerm: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/payment-terms - Create new Payment Term
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { paymentTerm, description } = createSchema.parse(body);
    
    const created = await prisma.paymentTerm.create({
      data: { 
        paymentTerm: paymentTerm.trim(),
        description: description?.trim() || null,
      },
      select: { 
        id: true, 
        paymentTerm: true,
        description: true,
        createdAt: true 
      }
    });
    
    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('Payment term already exists', 409);
    }
    console.error("Create payment term error:", error);
    return Error("Failed to create payment term");
  }
}
