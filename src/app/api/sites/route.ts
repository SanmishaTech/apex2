import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import { ROLES } from "@/config/roles";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  validatePAN,
  validateTAN,
  validateCIN,
  validateGST,
} from "@/lib/tax-validation";

const createSchema = z.object({
  siteCode: z.string().optional().nullable(),
  site: z.string().min(1, "Site name is required"),
  shortName: z.string().optional().nullable(),
  companyId: z.number().optional().nullable(),
  status: z.enum(["Ongoing", "Hold", "Closed"]).default("Ongoing"),
  attachCopyUrl: z.string().optional().nullable(),
  contactPersons: z
    .array(
      z.object({
        name: z.string().min(1, "Name is required"),
        contactNo: z.string().min(1, "Contact number is required"),
        email: z
          .string()
          .email("Invalid email address")
          .optional()
          .or(z.literal("")),
      })
    )
    .min(1, "At least one contact person is required"),
  deliveryAddresses: z
    .array(
      z.object({
        addressLine1: z.string().optional().nullable(),
        addressLine2: z.string().optional().nullable(),
        stateId: z.number().optional().nullable(),
        cityId: z.number().optional().nullable(),
        pinCode: z.string().optional().nullable(),
      })
    )
    .optional(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  panNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validatePAN(val), {
      message:
        "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)",
    }),
  gstNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateGST(val), {
      message: "Invalid GST format. Format: 99AAAAA9999A9A9",
    }),
  tanNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateTAN(val), {
      message:
        "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)",
    }),
  cinNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateCIN(val), {
      message: "Invalid CIN format. Format: U99999AA9999AAA999999",
    }),
});

// GET /api/sites?search=&status=Ongoing|Hold|Monitor&page=1&perPage=10&sort=site&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const statusParam = searchParams.get("status");
    const sort = (searchParams.get("sort") || "site") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
      | "asc"
      | "desc";

    // Build dynamic filter
    type SiteWhere = {
      OR?: Array<{
        site?: { contains: string };
        shortName?: { contains: string };
        siteCode?: { contains: string };
        siteContactPersons?: {
          some: {
            OR: [
              { name: { contains: string } },
              { contactNo: { contains: string } }
            ];
          };
        };
      }>;
      status?: string;
      companyId?: number;
      stateId?: number;
      cityId?: number;
    };
    const where: SiteWhere = {};

    if (search) {
      where.OR = [
        { site: { contains: search } },
        { shortName: { contains: search } },
        { siteCode: { contains: search } },
        {
          siteContactPersons: {
            some: {
              OR: [
                { name: { contains: search } },
                { contactNo: { contains: search } },
              ],
            },
          },
        },
      ];
    }
    if (statusParam && ["Ongoing", "Hold", "Closed"].includes(statusParam)) {
      where.status = statusParam;
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
    const sortableFields = new Set([
      "site",
      "shortName",
      "siteCode",
      "status",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { site: "asc" };

    // Site-based visibility: non-admin and non-projectDirector see only their assigned sites
    const role = auth.user.role;
    const isPrivileged = role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      // If user has no assigned sites, return empty early
      if (!assignedSiteIds || assignedSiteIds.length === 0) {
        return Success({
          data: [],
          page,
          perPage,
          total: 0,
          totalPages: 1,
        } as any);
      }

      // Constrain by assigned site IDs. We can't directly add an 'in' to SiteWhere typed object easily,
      // but paginate() accepts generic where; we will pass a combined where below using any.
      (where as any).id = { in: assignedSiteIds };
    }

    const result = await paginate({
      model: prisma.site,
      where: where as any,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        siteCode: true,
        site: true,
        shortName: true,
        companyId: true,
        status: true,
        attachCopyUrl: true,
        // legacy top-level address fields (kept if present)
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        siteDeliveryAddresses: true,
        company: {
          select: {
            id: true,
            companyName: true,
            shortName: true,
          },
        },
        state: {
          select: {
            id: true,
            state: true,
          },
        },
        city: {
          select: {
            id: true,
            city: true,
          },
        },
        siteContactPersons: true,
        _count: {
          select: {
            assignedManpower: true,
            siteBudgets: true,
          },
        },
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
    const contentType = req.headers.get("content-type") || "";
    let siteData: any;
    let attachCopyFile: File | null = null;

    // Handle multipart form data for file uploads
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      attachCopyFile = form.get("attachCopy") as File;

      // Extract all form data
      const formData = Object.fromEntries(form.entries());

      // Handle contact persons
      let contactPersonsData: Array<{
        name: string;
        contactNo: string;
        email?: string;
      }> = [];
      const contactPersonsValue = form.get("contactPersons");
      if (contactPersonsValue && typeof contactPersonsValue === "string") {
        try {
          contactPersonsData = JSON.parse(contactPersonsValue);
        } catch (e) {
          console.error("Error parsing contact persons:", e);
        }
      }

      // Handle delivery addresses (sent as JSON string in multipart form)
      let deliveryAddressesData: Array<{
        addressLine1?: string | null;
        addressLine2?: string | null;
        stateId?: number | null;
        cityId?: number | null;
        pinCode?: string | null;
      }> = [];
      const deliveryAddressesValue = form.get("deliveryAddresses");
      if (
        deliveryAddressesValue &&
        typeof deliveryAddressesValue === "string"
      ) {
        try {
          deliveryAddressesData = JSON.parse(deliveryAddressesValue);
        } catch (e) {
          console.error("Error parsing delivery addresses:", e);
        }
      }

      // Prepare site data
      siteData = {
        siteCode: form.get("siteCode") || null,
        site: form.get("site") || null,
        shortName: form.get("shortName") || null,
        companyId: form.get("companyId") ? Number(form.get("companyId")) : null,
        status: form.get("status") || null,
        contactPersons: contactPersonsData,
        deliveryAddresses: deliveryAddressesData.length
          ? deliveryAddressesData
          : undefined,
        addressLine1: form.get("addressLine1") || null,
        addressLine2: form.get("addressLine2") || null,
        stateId: form.get("stateId") ? Number(form.get("stateId")) : null,
        cityId: form.get("cityId") ? Number(form.get("cityId")) : null,
        pinCode: form.get("pinCode") || null,
        longitude: form.get("longitude") || null,
        latitude: form.get("latitude") || null,
        panNo: form.get("panNo") || null,
        gstNo: form.get("gstNo") || null,
        tanNo: form.get("tanNo") || null,
        cinNo: form.get("cinNo") || null,
      };
    } else {
      // Handle JSON data
      siteData = await req.json();
    }

    // Handle file upload if present
    let attachCopyUrl: string | null = null;
    if (attachCopyFile && "size" in attachCopyFile && attachCopyFile.size > 0) {
      // Validate file size
      if (attachCopyFile.size > 20 * 1024 * 1024) {
        return ApiError("Attach copy file too large (max 20MB)", 413);
      }

      // Generate unique filename and save
      const ext = path.extname(attachCopyFile.name) || ".pdf";
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), "uploads", "sites");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await attachCopyFile.arrayBuffer())
      );
      attachCopyUrl = `/uploads/sites/${filename}`;
    }

    const validatedData = createSchema.parse({
      ...siteData,
      attachCopyUrl,
    });

    // Create the site
    // Use a transaction to ensure both site and contact persons are created together
    const result = await prisma.$transaction(async (prisma) => {
      // Create the site
      const site = await prisma.site.create({
        data: {
          siteCode: validatedData.siteCode,
          site: validatedData.site,
          shortName: validatedData.shortName,
          companyId: validatedData.companyId,
          status: validatedData.status,
          attachCopyUrl: validatedData.attachCopyUrl,
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
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
              shortName: true,
            },
          },
          state: {
            select: {
              id: true,
              state: true,
            },
          },
          city: {
            select: {
              id: true,
              city: true,
            },
          },
          siteContactPersons: true,
        },
      });

      // Create contact persons
      if (validatedData.contactPersons?.length) {
        await prisma.siteContactPerson.createMany({
          data: validatedData.contactPersons.map((person) => ({
            siteId: site.id,
            name: person.name,
            contactNo: person.contactNo,
            email: person.email || null,
          })),
        });
      }

      // Create delivery addresses if provided
      if (
        validatedData.deliveryAddresses &&
        validatedData.deliveryAddresses.length
      ) {
        await prisma.siteDeliveryAddress.createMany({
          data: validatedData.deliveryAddresses.map((addr) => ({
            siteId: site.id,
            addressLine1: addr.addressLine1 || null,
            addressLine2: addr.addressLine2 || null,
            stateId: addr.stateId ?? null,
            cityId: addr.cityId ?? null,
            pinCode: addr.pinCode || null,
          })),
        });
      }

      // Fetch the site with all its relations
      return await prisma.site.findUnique({
        where: { id: site.id },
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
              shortName: true,
            },
          },
          state: {
            select: {
              id: true,
              state: true,
            },
          },
          city: {
            select: {
              id: true,
              city: true,
            },
          },
          siteContactPersons: true,
          siteDeliveryAddresses: true,
        },
      });
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return ApiError("Site already exists", 409);
    }
    console.error("Create site error:", error);
    return ApiError("Failed to create site");
  }
}
