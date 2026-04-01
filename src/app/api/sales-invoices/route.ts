import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";
import { PERMISSIONS, ROLES } from "@/config/roles";

const salesInvoiceDetailSchema = z.object({
  boqItemId: z.coerce.number().min(1, "BOQ Item is required"),
  particulars: z.string().nullable().optional(),
  totalBoqQty: z.coerce
    .number()
    .min(0, "Total BOQ Qty must be non-negative")
    .max(9999999999.9999, "Total BOQ Qty must be <= 9,999,999,999.9999"),
  invoiceQty: z.coerce
    .number()
    .min(0.0001, "Invoice Qty must be greater than 0")
    .max(9999999999.9999, "Invoice Qty must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  discount: z.coerce
    .number()
    .min(0, "Discount must be non-negative")
    .max(9999999999.99, "Discount must be <= 9,999,999,999.99")
    .optional()
    .nullable(),
  discountAmount: z.coerce.number().optional().nullable(),
  cgst: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .optional()
    .nullable(),
  cgstAmt: z.coerce.number().optional().nullable(),
  sgst: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .optional()
    .nullable(),
  sgstAmt: z.coerce.number().optional().nullable(),
  igst: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .optional()
    .nullable(),
  igstAmt: z.coerce.number().optional().nullable(),
  amount: z.coerce.number(),
});

const createSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required"),
  boqId: z.coerce.number().min(1, "BOQ is required"),
  billingAddressId: z.coerce.number().min(1, "Billing Address is required"),
  invoiceDate: z.string().transform((val) => new Date(val)),
  fromDate: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? new Date(val) : null)),
  toDate: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? new Date(val) : null)),
  grossAmount: z.coerce.number().optional().default(0),
  tds: z.coerce.number().optional().default(0),
  wct: z.coerce.number().optional().default(0),
  lwf: z.coerce.number().optional().default(0),
  other: z.coerce.number().optional().default(0),
  totalAmount: z.coerce.number(),
  salesInvoiceDetails: z
    .array(salesInvoiceDetailSchema)
    .min(1, "At least one item is required"),
});

const COMPANY_CODE = "DCTPL";
const SITE_CODE_MISSING_ERROR = "SITE_CODE_MISSING";

function normalizeYear(year: number): number {
  if (!Number.isFinite(year)) {
    return new Date().getFullYear();
  }

  if (year < 100) {
    return 2000 + year;
  }

  return year;
}

function getFinancialYearInfo(rawDate: Date) {
  const fallback = new Date();
  const date = Number.isNaN(rawDate.getTime()) ? fallback : rawDate;

  const rawMonth = date.getMonth();
  const month = Number.isFinite(rawMonth) ? rawMonth : fallback.getMonth();

  const rawYear = date.getFullYear();
  const year = normalizeYear(rawYear);
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;

  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(endYear, 3, 0, 23, 59, 59, 999));

  const formatYear = (y: number) =>
    normalizeYear(y).toString().slice(-2).padStart(2, "0");
  const financialYearLabel = `${formatYear(startYear)}-${formatYear(endYear)}`;

  return {
    startDate,
    endDate,
    financialYearLabel,
  };
}

async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  _invoiceDate: Date,
  opts: { siteId: number }
): Promise<string> {
  const { startDate, endDate, financialYearLabel } = getFinancialYearInfo(
    new Date()
  );

  const site = await tx.site.findUnique({
    where: { id: opts.siteId },
    select: { siteCode: true },
  });
  if (!site) {
    throw new Error("Invalid site");
  }
  if (!site.siteCode) {
    throw new Error(SITE_CODE_MISSING_ERROR);
  }

  const prefix = `SI/${financialYearLabel}/${site.siteCode}/`;

  const latestInvoice = await tx.salesInvoice.findFirst({
    where: {
      invoiceDate: {
        gte: startDate,
        lte: endDate,
      },
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
    select: {
      invoiceNumber: true,
    },
  });

  const lastSequence = latestInvoice
    ? parseInt(latestInvoice.invoiceNumber.slice(prefix.length), 10) || 0
    : 0;

  const nextSequence = (lastSequence + 1).toString().padStart(5, "0");

  return `${prefix}${nextSequence}`;
}

// GET /api/sales-invoices?search=&page=1&perPage=10&sort=invoiceDate&order=desc&site=&boq=
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
    const siteFilter = searchParams.get("site") || "";
    const boqFilter = searchParams.get("boq") || "";
    const authorizedFilter = searchParams.get("authorized") || "";
    const sort = (searchParams.get("sort") || "invoiceDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { site: { site: { contains: search } } },
        { boq: { workName: { contains: search } } },
      ];
    }

    // Site-based visibility
    const role = auth.user.role;
    const isPrivileged =
      role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    let assignedSiteIds: number[] | null = null;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      assignedSiteIds = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      if (!siteFilter && (!assignedSiteIds || assignedSiteIds.length === 0)) {
        return Success({
          data: [],
          meta: { page, perPage, total: 0, totalPages: 1 },
        });
      }
    }

    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        if (!isPrivileged && assignedSiteIds) {
          if (!assignedSiteIds.includes(siteId)) {
            return Success({
              data: [],
              meta: { page, perPage, total: 0, totalPages: 1 },
            });
          }
        }
        where.siteId = siteId;
      }
    } else if (!isPrivileged && assignedSiteIds && assignedSiteIds.length > 0) {
      where.siteId = { in: assignedSiteIds };
    }

    if (boqFilter) {
      const boqId = parseInt(boqFilter);
      if (!isNaN(boqId)) {
        where.boqId = boqId;
      }
    }

    if (authorizedFilter === "true") {
      where.authorizedById = { not: null };
    } else if (authorizedFilter === "false") {
      where.authorizedById = null;
    }

    const sortableFields = new Set([
      "invoiceNumber",
      "invoiceDate",
      "createdAt",
      "totalAmount",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { invoiceDate: "desc" };

    const result = await paginate({
      model: prisma.salesInvoice as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        invoiceNumber: true,
        revision: true,
        invoiceDate: true,
        fromDate: true,
        toDate: true,
        siteId: true,
        boqId: true,
        billingAddressId: true,
        grossAmount: true,
        tds: true,
        wct: true,
        lwf: true,
        other: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        authorizedById: true,
        createdById: true,
        updatedById: true,
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        boq: {
          select: {
            id: true,
            workName: true,
            boqNo: true,
          },
        },
        billingAddress: {
          select: {
            id: true,
            companyName: true,
          },
        },
        authorizedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        salesInvoiceDetails: {
          select: {
            id: true,
            boqItemId: true,
            boqItem: {
              select: {
                id: true,
                item: true,
              },
            },
            invoiceQty: true,
            rate: true,
            amount: true,
          },
        },
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
    console.error("Get sales invoices error:", error);
    return ApiError("Failed to fetch sales invoices");
  }
}

// POST /api/sales-invoices - Create new sales invoice
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsedData = createSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Generate financial year-based invoice number
      const invoiceNumber = await generateInvoiceNumber(
        tx,
        parsedData.invoiceDate,
        { siteId: parsedData.siteId }
      );

      const invoiceData: any = {
        invoiceNumber,
        revision: "00",
        invoiceDate: parsedData.invoiceDate,
        fromDate: parsedData.fromDate,
        toDate: parsedData.toDate,
        siteId: parsedData.siteId,
        boqId: parsedData.boqId,
        billingAddressId: parsedData.billingAddressId,
        grossAmount: parsedData.grossAmount,
        tds: parsedData.tds,
        wct: parsedData.wct,
        lwf: parsedData.lwf,
        other: parsedData.other,
        totalAmount: parsedData.totalAmount,
        createdById: auth.user.id,
        updatedById: auth.user.id,
      };

      const salesInvoice = await tx.salesInvoice.create({
        data: invoiceData,
        select: {
          id: true,
          invoiceNumber: true,
          revision: true,
          invoiceDate: true,
          fromDate: true,
          toDate: true,
          siteId: true,
          boqId: true,
          billingAddressId: true,
          grossAmount: true,
          tds: true,
          wct: true,
          lwf: true,
          other: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          boq: {
            select: {
              id: true,
              workName: true,
            },
          },
          billingAddress: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
      });

      // Create invoice details
      const detailsData = parsedData.salesInvoiceDetails.map((detail, index) => ({
        salesInvoiceId: salesInvoice.id,
        boqItemId: detail.boqItemId,
        particulars: detail.particulars ?? "",
        totalBoqQty: detail.totalBoqQty,
        invoiceQty: detail.invoiceQty,
        rate: detail.rate,
        discount: detail.discount,
        discountAmount: detail.discountAmount,
        cgst: detail.cgst,
        cgstAmt: detail.cgstAmt,
        sgst: detail.sgst,
        sgstAmt: detail.sgstAmt,
        igst: detail.igst,
        igstAmt: detail.igstAmt,
        amount: detail.amount,
      }));

      // Create invoice details one-by-one so we can capture the generated IDs
      const createdDetails: any[] = [];

      for (const detail of detailsData) {
        const created = await tx.salesInvoiceDetail.create({
          data: detail,
          select: {
            id: true,
            boqItemId: true,
            particulars: true,
            totalBoqQty: true,
            invoiceQty: true,
            rate: true,
            discount: true,
            discountAmount: true,
            cgst: true,
            cgstAmt: true,
            sgst: true,
            sgstAmt: true,
            igst: true,
            igstAmt: true,
            amount: true,
          },
        });
        createdDetails.push(created);
      }

      // Fetch user name for log
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { name: true },
      });

      // Create log entry
      const salesInvoiceLog = await tx.salesInvoiceLog.create({
        data: {
          salesInvoiceId: salesInvoice.id,
          siteId: salesInvoice.siteId,
          logType: "CREATE",
          boqId: salesInvoice.boqId,
          invoiceNumber: salesInvoice.invoiceNumber,
          revision: salesInvoice.revision,
          invoiceDate: salesInvoice.invoiceDate,
          fromDate: salesInvoice.fromDate,
          toDate: salesInvoice.toDate,
          billingAddressId: salesInvoice.billingAddressId,
          grossAmount: salesInvoice.grossAmount,
          tds: salesInvoice.tds,
          wct: salesInvoice.wct,
          lwf: salesInvoice.lwf,
          other: salesInvoice.other,
          totalAmount: salesInvoice.totalAmount,
          createdById: auth.user.id,
          createdByName: user?.name || "Unknown",
        },
      });

      // Create detail logs
      // Build detail log data using the real created detail IDs
      const detailLogsData = createdDetails.map((created) => ({
        salesInvoiceLogId: salesInvoiceLog.id,
        salesInvoiceDetailId: created.id,
        boqItemId: created.boqItemId,
        particulars: created.particulars ?? "",
        totalBoqQty: created.totalBoqQty,
        invoiceQty: created.invoiceQty,
        rate: created.rate,
        discount: created.discount,
        discountAmount: created.discountAmount,
        cgst: created.cgst,
        cgstAmt: created.cgstAmt,
        sgst: created.sgst,
        sgstAmt: created.sgstAmt,
        igst: created.igst,
        igstAmt: created.igstAmt,
        amount: created.amount,
      }));

      if (detailLogsData.length > 0) {
        await tx.salesInvoiceDetailLog.createMany({
          data: detailLogsData,
        });
      }

      // Fetch the created invoice with details
      const invoiceWithDetails = await tx.salesInvoice.findUnique({
        where: { id: salesInvoice.id },
        select: {
          id: true,
          invoiceNumber: true,
          revision: true,
          invoiceDate: true,
          fromDate: true,
          toDate: true,
          siteId: true,
          boqId: true,
          billingAddressId: true,
          grossAmount: true,
          tds: true,
          wct: true,
          lwf: true,
          other: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          boq: {
            select: {
              id: true,
              workName: true,
            },
          },
          billingAddress: {
            select: {
              id: true,
              companyName: true,
            },
          },
          salesInvoiceDetails: {
            select: {
              id: true,
              boqItemId: true,
              boqItem: {
                select: {
                  id: true,
                  item: true,
                },
              },
              particulars: true,
              totalBoqQty: true,
              invoiceQty: true,
              rate: true,
              discount: true,
              discountAmount: true,
              cgst: true,
              cgstAmt: true,
              sgst: true,
              sgstAmt: true,
              igst: true,
              igstAmt: true,
              amount: true,
            },
          },
        },
      });

      return invoiceWithDetails;
    });

    return Success(result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error instanceof Error && error.message === SITE_CODE_MISSING_ERROR) {
      return BadRequest(
        "Site Code is not added. Please add Site Code to generate the Invoice Number."
      );
    }
    if ((error as any).code === "P2002") {
      return ApiError("Invoice number already exists", 409);
    }
    console.error("Create sales invoice error:", error);
    return ApiError("Failed to create sales invoice");
  }
}
