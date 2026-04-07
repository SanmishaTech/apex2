import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";
import { PERMISSIONS, ROLES } from "@/config/roles";

const invoiceItemSchema = z.object({
  subContractorWorkOrderDetailId: z.coerce.number().min(1, "Work Order Item is required"),
  particulars: z.string().min(1, "Particulars are required"),
  workOrderQty: z.coerce.number().min(0, "Work Order Qty must be non-negative"),
  currentBillQty: z.coerce
    .number()
    .min(0.0001, "Current Bill Qty must be greater than 0")
    .max(9999999999.9999, "Current Bill Qty must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  discountPercent: z.coerce
    .number()
    .min(0, "Discount % must be non-negative")
    .max(100, "Discount % must be <= 100")
    .default(0),
  discountAmount: z.coerce.number().default(0),
  cgstPercent: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .default(0),
  sgstpercent: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .default(0),
  igstPercent: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .default(0),
  cgstAmt: z.coerce.number().default(0),
  sgstAmt: z.coerce.number().default(0),
  igstAmt: z.coerce.number().default(0),
  totalLineAmount: z.coerce.number(),
});

const createSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required"),
  subcontractorWorkOrderId: z.coerce.number().min(1, "Work Order is required"),
  invoiceNumber: z.string().min(1, "Invoice Number is required"),
  invoiceDate: z.string().transform((val) => new Date(val)),
  fromDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  toDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  grossAmount: z.coerce.number().min(0, "Gross Amount must be non-negative"),
  retentionAmount: z.coerce.number().min(0, "Retention Amount must be non-negative").default(0),
  tds: z.coerce.number().min(0, "TDS must be non-negative").default(0),
  lwf: z.coerce.number().min(0, "LWF must be non-negative").default(0),
  otherDeductions: z.coerce.number().min(0, "Other Deductions must be non-negative").default(0),
  netPayable: z.coerce.number().min(0, "Net Payable must be non-negative"),
  status: z.enum(["PENDING", "PAID"]).default("PENDING"),
  invoiceItems: z.array(invoiceItemSchema).min(1, "At least one item is required"),
});

const updateSchema = createSchema.partial().extend({
  statusAction: z.enum(["authorize", "markPaid"]).optional(),
  remarks: z.string().optional().nullable(),
});

const COMPANY_CODE = "SCI";

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
  const month = date.getMonth();
  const year = normalizeYear(date.getFullYear());
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(endYear, 3, 0, 23, 59, 59, 999));
  const formatYear = (y: number) => normalizeYear(y).toString().slice(-2).padStart(2, "0");
  const financialYearLabel = `${formatYear(startYear)}-${formatYear(endYear)}`;
  return { startDate, endDate, financialYearLabel };
}

async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  _invoiceDate: Date,
  opts: { siteId: number }
): Promise<string> {
  const { startDate, endDate, financialYearLabel } = getFinancialYearInfo(new Date());
  const site = await tx.site.findUnique({
    where: { id: opts.siteId },
    select: { siteCode: true },
  });
  if (!site || !site.siteCode) {
    throw new Error("Invalid site or missing site code");
  }
  const prefix = `${COMPANY_CODE}/${financialYearLabel}/${site.siteCode}/`;
  const latest = await tx.subContractorInvoice.findFirst({
    where: {
      invoiceDate: { gte: startDate, lte: endDate },
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const lastSequence = latest
    ? parseInt(latest.invoiceNumber.slice(prefix.length), 10) || 0
    : 0;
  const nextSequence = (lastSequence + 1).toString().padStart(5, "0");
  return `${prefix}${nextSequence}`;
}

// GET /api/sub-contractor-invoices?search=&page=1&perPage=10&sort=invoiceDate&order=desc&site=&status=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  const permSet = new Set((auth.user.permissions || []) as string[]);
  if (!permSet.has(PERMISSIONS.READ_SUB_CONTRACTOR_INVOICES)) {
    return BadRequest("Missing permission to read sub contractor invoices");
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const siteFilter = searchParams.get("site") || "";
    const statusFilter = searchParams.get("status") || "";
    const workOrderFilter = searchParams.get("workOrder") || "";
    const sort = (searchParams.get("sort") || "invoiceDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { subcontractorWorkOrder: { workOrderNo: { contains: search } } },
      ];
    }

    const role = auth.user.role;
    const isPrivileged = role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    let assignedSiteIds: number[] | null = null;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      assignedSiteIds = (employee?.siteEmployees || []).map((s) => s.siteId).filter((v): v is number => !!v);
      if (!siteFilter && (!assignedSiteIds || assignedSiteIds.length === 0)) {
        return Success({ data: [], meta: { page, perPage, total: 0, totalPages: 1 } });
      }
    }

    if (siteFilter) {
      if (!isPrivileged && assignedSiteIds && assignedSiteIds.length > 0) {
        where.site = { site: { contains: siteFilter }, id: { in: assignedSiteIds } };
      } else {
        where.site = { site: { contains: siteFilter } };
      }
    } else if (!isPrivileged && assignedSiteIds && assignedSiteIds.length > 0) {
      where.siteId = { in: assignedSiteIds };
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    if (workOrderFilter) {
      where.subcontractorWorkOrder = { workOrderNo: { contains: workOrderFilter } };
    }

    const sortableFields = new Set(["invoiceNumber", "invoiceDate", "createdAt", "status"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { invoiceDate: "desc" };

    const result = await paginate({
      model: prisma.subContractorInvoice as any,
      where,
      orderBy,
      page,
      perPage,
      include: {
        site: { select: { id: true, site: true } },
        subcontractorWorkOrder: {
          select: { id: true, workOrderNo: true, subContractor: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
        authorizedBy: { select: { id: true, name: true } },
        _count: { select: { subContractorInvoiceDetails: true } },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get sub contractor invoices error:", error);
    return ApiError("Failed to fetch sub contractor invoices");
  }
}

// POST /api/sub-contractor-invoices - Create new invoice
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const permSet = new Set((auth.user.permissions || []) as string[]);
    if (!permSet.has(PERMISSIONS.CREATE_SUB_CONTRACTOR_INVOICES)) {
      return BadRequest("Missing permission to create sub contractor invoices");
    }

    const body = await req.json();
    const parsedData = createSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Validate work order exists and belongs to the site
      const workOrder = await tx.subContractorWorkOrder.findUnique({
        where: { id: parsedData.subcontractorWorkOrderId },
        include: {
          subContractorWorkOrderDetails: true,
        },
      });

      if (!workOrder) {
        throw new Error("Work order not found");
      }

      if (workOrder.siteId !== parsedData.siteId) {
        throw new Error("Work order does not belong to the selected site");
      }

      // Check for duplicate invoice number
      const existingInvoice = await tx.subContractorInvoice.findUnique({
        where: { invoiceNumber: parsedData.invoiceNumber },
      });

      if (existingInvoice) {
        throw new Error("Invoice number already exists");
      }

      // Validate invoice items against work order items
      for (const item of parsedData.invoiceItems) {
        const woItem = workOrder.subContractorWorkOrderDetails.find(
          (d) => d.id === item.subContractorWorkOrderDetailId
        );
        if (!woItem) {
          throw new Error(`Work order item ${item.subContractorWorkOrderDetailId} not found`);
        }
        if (item.currentBillQty > Number(woItem.qty)) {
          throw new Error(`Current Bill Qty exceeds Work Order Qty for item ${woItem.item}`);
        }
      }

      const invoice = await tx.subContractorInvoice.create({
        data: {
          siteId: parsedData.siteId,
          subcontractorWorkOrderId: parsedData.subcontractorWorkOrderId,
          invoiceNumber: parsedData.invoiceNumber,
          invoiceDate: parsedData.invoiceDate,
          fromDate: parsedData.fromDate,
          toDate: parsedData.toDate,
          grossAmount: parsedData.grossAmount,
          retentionAmount: parsedData.retentionAmount,
          tds: parsedData.tds,
          lwf: parsedData.lwf,
          otherDeductions: parsedData.otherDeductions,
          netPayable: parsedData.netPayable,
          amountInWords: amountInWords(parsedData.netPayable),
          status: parsedData.status,
          isAuthorized: false,
          createdById: auth.user.id,
          updatedById: auth.user.id,
          subContractorInvoiceDetails: {
            create: parsedData.invoiceItems.map((item) => ({
              subContractorWorkOrderDetailId: item.subContractorWorkOrderDetailId,
              particulars: item.particulars,
              workOrderQty: item.workOrderQty,
              currentBillQty: item.currentBillQty,
              rate: item.rate,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              cgstPercent: item.cgstPercent,
              sgstpercent: item.sgstpercent,
              igstPercent: item.igstPercent,
              cgstAmt: item.cgstAmt,
              sgstAmt: item.sgstAmt,
              igstAmt: item.igstAmt,
              totalLineAmount: item.totalLineAmount,
            })),
          },
        },
        include: {
          subContractorInvoiceDetails: {
            include: {
              subContractorWorkOrderDetail: true,
            },
          },
          site: { select: { id: true, site: true } },
          subcontractorWorkOrder: {
            select: { id: true, workOrderNo: true, subContractor: { select: { id: true, name: true } } },
          },
        },
      });

      // Create log entry
      // Fetch user name for log
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { name: true },
      });

      const log = await tx.subContractorInvoiceLog.create({
        data: {
          subContractorInvoiceId: invoice.id,
          siteId: invoice.siteId,
          subcontractorWorkOrderId: invoice.subcontractorWorkOrderId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          fromDate: invoice.fromDate,
          toDate: invoice.toDate,
          logType: "CREATE",
          grossAmount: invoice.grossAmount,
          retentionAmount: invoice.retentionAmount,
          tds: invoice.tds,
          lwf: invoice.lwf,
          otherDeductions: invoice.otherDeductions,
          netPayable: invoice.netPayable,
          status: invoice.status,
          isAuthorized: invoice.isAuthorized,
          amountInWords: invoice.amountInWords,
          subContractorInvoicefilePath: invoice.subContractorInvoicefilePath,
          isAuthorizedPrinted: invoice.isAuthorizedPrinted,
          createdById: auth.user.id,
          createdByName: user?.name || "Unknown",
        },
      });

      // Create detail logs
      await tx.subContractorInvoiceDetailLog.createMany({
        data: invoice.subContractorInvoiceDetails.map((d: any) => ({
          subContractorInvoiceLogId: log.id,
          subContractorInvoiceDetailId: d.id,
          subContractorWorkOrderDetailId: d.subContractorWorkOrderDetailId,
          particulars: d.particulars,
          workOrderQty: d.workOrderQty,
          currentBillQty: d.currentBillQty,
          rate: d.rate,
          discountPercent: d.discountPercent,
          discountAmount: d.discountAmount,
          cgstPercent: d.cgstPercent,
          sgstpercent: d.sgstpercent,
          igstPercent: d.igstPercent,
          cgstAmt: d.cgstAmt,
          sgstAmt: d.sgstAmt,
          igstAmt: d.igstAmt,
          totalLineAmount: d.totalLineAmount,
        })),
      });

      return invoice;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    if (error.code === "P2002") {
      return ApiError("Invoice number already exists", 409);
    }
    console.error("Create sub contractor invoice error:", error);
    return ApiError(error.message || "Failed to create sub contractor invoice");
  }
}
