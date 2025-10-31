import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { validatePAN, validateTAN, validateCIN, validateGST } from "@/lib/tax-validation";
import type { Prisma } from "@prisma/client";

const createSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  shortName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  closed: z.boolean().default(false),
  panNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validatePAN(val), {
      message: "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)"
    }),
  gstNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validateGST(val), {
      message: "Invalid GST format. Format: 99AAAAA9999A9A9"
    }),
  tanNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validateTAN(val), {
      message: "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)"
    }),
  cinNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validateCIN(val), {
      message: "Invalid CIN format. Format: U99999AA9999AAA999999"
    }),
});

// GET /api/companies?search=&closed=true|false&page=1&perPage=10&sort=companyName&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const closedParam = searchParams.get("closed");
    const sort = (searchParams.get("sort") || "companyName") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    // Build dynamic filter
    type CompanyWhere = {
      OR?: Array<{
        companyName?: { contains: string };
        shortName?: { contains: string };
        contactPerson?: { contains: string };
      }>;
      closed?: boolean;
      stateId?: number;
      cityId?: number;
    };
    const where: CompanyWhere = {};
    
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { shortName: { contains: search } },
        { contactPerson: { contains: search } },
      ];
    }
    if (closedParam === "true" || closedParam === "false") {
      where.closed = closedParam === "true";
    }
    
    const stateIdParam = searchParams.get("stateId");
    if (stateIdParam && !isNaN(Number(stateIdParam))) {
      where.stateId = Number(stateIdParam);
    }

    const cityIdParam = searchParams.get("cityId");
    if (cityIdParam && !isNaN(Number(cityIdParam))) {
      where.cityId = Number(cityIdParam);
    }

    // Allow listed sortable fields only
    const sortableFields = new Set(["companyName", "shortName", "contactPerson", "closed", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) 
      ? { [sort]: order } 
      : { companyName: "asc" };

    const result = await paginate({
      model: prisma.company as any,
      where,
      orderBy,
      page,
      perPage,
      select: { 
        id: true, 
        companyName: true, 
        shortName: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        logoUrl: true,
        closed: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        },
        city: {
          select: {
            id: true,
            city: true
          }
        }
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get companies error:", error);
    return ApiError("Failed to fetch companies");
  }
}

// Helper to support lightweight dropdown lists without pagination metadata
async function listCompaniesForDropdown(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const searchParams = new URL(req.url).searchParams;
    const perPage = Math.min(1000, Math.max(1, Number(searchParams.get('perPage')) || 1000));
    const search = searchParams.get('search')?.trim().toLowerCase() ?? '';

    const where = search
      ? {
          OR: [
            { companyName: { contains: search } },
            { shortName: { contains: search} },
          ],
        }
      : undefined;

    const companies = await prisma.company.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        shortName: true,
      },
      orderBy: { companyName: 'asc' },
      take: perPage,
    });

    return Success({ data: companies });
  } catch (error) {
    return ApiError('Failed to retrieve companies.');
  }
}

export const GETDropdown = listCompaniesForDropdown;

// POST /api/companies - Create new company
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let companyData: Record<string, unknown>;
    let logoFile: File | null = null;

    // Handle multipart form data for file uploads
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      logoFile = form.get('logo') as File;
      
      // Extract other form data
      companyData = {
        companyName: form.get('companyName'),
        shortName: form.get('shortName') || null,
        contactPerson: form.get('contactPerson') || null,
        contactNo: form.get('contactNo') || null,
        addressLine1: form.get('addressLine1') || null,
        addressLine2: form.get('addressLine2') || null,
        stateId: form.get('stateId') ? Number(form.get('stateId')) : null,
        cityId: form.get('cityId') ? Number(form.get('cityId')) : null,
        pinCode: form.get('pinCode') || null,
        closed: form.get('closed') === 'true',
        panNo: form.get('panNo') || null,
        gstNo: form.get('gstNo') || null,
        tanNo: form.get('tanNo') || null,
        cinNo: form.get('cinNo') || null,
      };
    } else {
      // Handle JSON data
      companyData = await req.json();
    }

    // Handle logo upload if present
    let logoUrl: string | null = null;
    if (logoFile && logoFile.size > 0) {
      // Validate file type and size
      if (!logoFile.type?.startsWith('image/')) {
        return ApiError('Logo must be an image file', 415);
      }
      if (logoFile.size > 20 * 1024 * 1024) {
        return ApiError('Logo file too large (max 20MB)', 413);
      }
      
      // Generate unique filename and save
      const ext = path.extname(logoFile.name) || '.png';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'uploads', 'companies');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await logoFile.arrayBuffer()));
      logoUrl = `/uploads/companies/${filename}`;
    }

    const validatedData = createSchema.parse({
      ...companyData,
      logoUrl,
    });

    // Map foreign key ids to relation connects to satisfy Prisma typed input
    const { stateId, cityId, ...rest } = validatedData as any;
    const createData: Prisma.CompanyCreateInput = {
      ...rest,
      ...(stateId ? { state: { connect: { id: stateId as number } } } : {}),
      ...(cityId ? { city: { connect: { id: cityId as number } } } : {}),
    };

    const created = await prisma.company.create({
      data: createData,
      select: { 
        id: true, 
        companyName: true, 
        shortName: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        logoUrl: true,
        closed: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        stateId: true,
        cityId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        },
        city: {
          select: {
            id: true,
            city: true
          }
        }
      }
    });
    
    return Success(created, 201);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return ApiError('Company already exists', 409);
    }
    console.error("Create company error:", error);
    return ApiError("Failed to create company");
  }
}
