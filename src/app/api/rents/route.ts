import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

// Helper to coerce optional numeric fields that may arrive as strings from forms
function toOptionalNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeRentPayload(input: any) {
  if (!input || typeof input !== "object") return input;
  return {
    ...input,
    siteId: toOptionalNumber(input.siteId),
    boqId: toOptionalNumber(input.boqId),
    rentalCategoryId: toOptionalNumber(input.rentalCategoryId),
    rentTypeId: toOptionalNumber(input.rentTypeId),
    depositAmount: toOptionalNumber(input.depositAmount),
    rentAmount: toOptionalNumber(input.rentAmount),
  };
}

const createRentSchema = z.object({
  siteId: z.number().int().positive().optional(),
  boqId: z.number().int().positive().optional(),
  rentalCategoryId: z.number().int().positive().optional(),
  rentTypeId: z.number().int().positive().optional(),
  owner: z.string().optional(),
  pancardNo: z.string().optional(),
  rentDay: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  description: z.string().optional(),
  depositAmount: z.number().optional(),
  rentAmount: z.number().optional(),
  bank: z.string().optional(),
  branch: z.string().optional(),
  accountNo: z.string().optional(),
  accountName: z.string().optional(),
  ifscCode: z.string().optional(),
  momCopyUrl: z.string().optional(),
});

// GET - List rents with pagination & search
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
        { owner: { contains: search } },
        { description: { contains: search } },
        { pancardNo: { contains: search } },
        { site: { site: { contains: search } } },
        { boq: { boqNo: { contains: search } } },
        { rentalCategory: { rentalCategory: { contains: search } } },
        { rentType: { rentType: { contains: search } } },
      ];
    }

    const result = await paginate({
      model: prisma.rent,
      where,
      orderBy: { createdAt: "desc" },
      page,
      perPage,
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        boqId: true,
        boq: { select: { id: true, boqNo: true } },
        rentalCategoryId: true,
        rentalCategory: { select: { id: true, rentalCategory: true } },
        rentTypeId: true,
        rentType: { select: { id: true, rentType: true } },
        owner: true,
        pancardNo: true,
        rentDay: true,
        fromDate: true,
        toDate: true,
        description: true,
        depositAmount: true,
        rentAmount: true,
        bank: true,
        branch: true,
        accountNo: true,
        accountName: true,
        ifscCode: true,
        momCopyUrl: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Debug: Log pagination result
    console.log('Rents API Debug:', {
      requestedPage: page,
      requestedPerPage: perPage,
      where,
      resultTotal: result.total,
      resultTotalPages: result.totalPages,
      resultDataLength: result.data.length,
      timestamp: new Date().toISOString()
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
    console.error("Get rents error:", error);
    return Error("Failed to fetch rents");
  }
}

// POST - Create new rent
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const raw = await req.json();
    const body = normalizeRentPayload(raw);
    const validatedData = createRentSchema.parse(body);
    
    // Convert date strings to Date objects if provided and not empty
    const rentData: any = { ...validatedData };
    if (rentData.fromDate && rentData.fromDate.trim() !== '') {
      rentData.fromDate = new Date(rentData.fromDate);
    } else {
      delete rentData.fromDate; // Remove empty date fields
    }
    if (rentData.toDate && rentData.toDate.trim() !== '') {
      rentData.toDate = new Date(rentData.toDate);
    } else {
      delete rentData.toDate; // Remove empty date fields
    }
    
    const created = await prisma.rent.create({
      data: rentData,
      select: {
        id: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        boqId: true,
        boq: { select: { id: true, boqNo: true } },
        rentalCategoryId: true,
        rentalCategory: { select: { id: true, rentalCategory: true } },
        rentTypeId: true,
        rentType: { select: { id: true, rentType: true } },
        owner: true,
        pancardNo: true,
        rentDay: true,
        fromDate: true,
        toDate: true,
        description: true,
        depositAmount: true,
        rentAmount: true,
        bank: true,
        branch: true,
        accountNo: true,
        accountName: true,
        ifscCode: true,
        momCopyUrl: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    return Success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create rent error:", error);
    return Error("Failed to create rent");
  }
}
