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

const createSchema = z.object({
  uinNo: z.string().optional().nullable(),
  site: z.string().min(1, "Site name is required"),
  shortName: z.string().optional().nullable(),
  companyId: z.number().optional().nullable(),
  closed: z.boolean().default(false),
  permanentClosed: z.boolean().default(false),
  monitor: z.boolean().default(false),
  attachCopyUrl: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
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

// GET /api/sites?search=&closed=true|false&permanentClosed=true|false&monitor=true|false&page=1&perPage=10&sort=site&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const closedParam = searchParams.get("closed");
    const permanentClosedParam = searchParams.get("permanentClosed");
    const monitorParam = searchParams.get("monitor");
    const sort = (searchParams.get("sort") || "site") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

    // Build dynamic filter
    type SiteWhere = {
      OR?: Array<{
        site?: { contains: string };
        shortName?: { contains: string };
        uinNo?: { contains: string };
        contactPerson?: { contains: string };
      }>;
      closed?: boolean;
      permanentClosed?: boolean;
      monitor?: boolean;
      companyId?: number;
      stateId?: number;
      cityId?: number;
    };
    const where: SiteWhere = {};
    
    if (search) {
      where.OR = [
        { site: { contains: search } },
        { shortName: { contains: search } },
        { uinNo: { contains: search } },
        { contactPerson: { contains: search } },
      ];
    }
    if (closedParam === "true" || closedParam === "false") {
      where.closed = closedParam === "true";
    }
    if (permanentClosedParam === "true" || permanentClosedParam === "false") {
      where.permanentClosed = permanentClosedParam === "true";
    }
    if (monitorParam === "true" || monitorParam === "false") {
      where.monitor = monitorParam === "true";
    }
    
    const companyIdParam = searchParams.get("companyId");
    if (companyIdParam && !isNaN(Number(companyIdParam))) {
      where.companyId = Number(companyIdParam);
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
    const sortableFields = new Set(["site", "shortName", "uinNo", "contactPerson", "closed", "permanentClosed", "monitor", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) 
      ? { [sort]: order } 
      : { site: "asc" };

    const result = await paginate({
      model: prisma.site,
      where,
      orderBy,
      page,
      perPage,
      select: { 
        id: true, 
        uinNo: true,
        site: true, 
        shortName: true,
        companyId: true,
        closed: true,
        permanentClosed: true,
        monitor: true,
        attachCopyUrl: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        longitude: true,
        latitude: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        company: {
          select: {
            id: true,
            companyName: true,
            shortName: true
          }
        },
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
        },
        _count: {
          select: {
            assignedManpower: true
          }
        }
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get sites error:", error);
    return ApiError("Failed to fetch sites");
  }
}

// POST /api/sites - Create new site
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const contentType = req.headers.get('content-type') || '';
    let siteData: any;
    let attachCopyFile: File | null = null;

    // Handle multipart form data for file uploads
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      attachCopyFile = form.get('attachCopy') as File;
      
      // Extract other form data
      siteData = {
        uinNo: form.get('uinNo') || null,
        site: form.get('site'),
        shortName: form.get('shortName') || null,
        companyId: form.get('companyId') ? Number(form.get('companyId')) : null,
        closed: form.get('closed') === 'true',
        permanentClosed: form.get('permanentClosed') === 'true',
        monitor: form.get('monitor') === 'true',
        contactPerson: form.get('contactPerson') || null,
        contactNo: form.get('contactNo') || null,
        addressLine1: form.get('addressLine1') || null,
        addressLine2: form.get('addressLine2') || null,
        stateId: form.get('stateId') ? Number(form.get('stateId')) : null,
        cityId: form.get('cityId') ? Number(form.get('cityId')) : null,
        pinCode: form.get('pinCode') || null,
        longitude: form.get('longitude') || null,
        latitude: form.get('latitude') || null,
        panNo: form.get('panNo') || null,
        gstNo: form.get('gstNo') || null,
        tanNo: form.get('tanNo') || null,
        cinNo: form.get('cinNo') || null,
      };
    } else {
      // Handle JSON data
      siteData = await req.json();
    }

    // Handle file upload if present
    let attachCopyUrl: string | null = null;
    if (attachCopyFile && attachCopyFile.size > 0) {
      // Validate file size
      if (attachCopyFile.size > 20 * 1024 * 1024) {
        return ApiError('Attach copy file too large (max 20MB)', 413);
      }
      
      // Generate unique filename and save
      const ext = path.extname(attachCopyFile.name) || '.pdf';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'uploads', 'sites');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await attachCopyFile.arrayBuffer()));
      attachCopyUrl = `/uploads/sites/${filename}`;
    }

    const validatedData = createSchema.parse({
      ...siteData,
      attachCopyUrl,
    });
    
    const created = await prisma.site.create({
      data: {
        uinNo: validatedData.uinNo,
        site: validatedData.site,
        shortName: validatedData.shortName,
        companyId: validatedData.companyId,
        closed: validatedData.closed,
        permanentClosed: validatedData.permanentClosed,
        monitor: validatedData.monitor,
        attachCopyUrl: validatedData.attachCopyUrl,
        contactPerson: validatedData.contactPerson,
        contactNo: validatedData.contactNo,
        addressLine1: validatedData.addressLine1,
        addressLine2: validatedData.addressLine2,
        stateId: validatedData.stateId,
        cityId: validatedData.cityId,
        pinCode: validatedData.pinCode,
        longitude: validatedData.longitude,
        latitude: validatedData.latitude,
        panNo: validatedData.panNo,
        gstNo: validatedData.gstNo,
        tanNo: validatedData.tanNo,
        cinNo: validatedData.cinNo,
      },
      select: { 
        id: true, 
        uinNo: true,
        site: true, 
        shortName: true,
        companyId: true,
        closed: true,
        permanentClosed: true,
        monitor: true,
        attachCopyUrl: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        longitude: true,
        latitude: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        stateId: true,
        cityId: true,
        company: {
          select: {
            id: true,
            companyName: true,
            shortName: true
          }
        },
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return ApiError('Site already exists', 409);
    }
    console.error("Create site error:", error);
    return ApiError("Failed to create site");
  }
}
