import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";
import { PERMISSIONS, ROLES } from "@/config/roles";

const workOrderItemSchema = z.object({
  isBoqItem: z.boolean().default(false),
  boqItemId: z.coerce.number().optional().nullable(),
  item: z.string().min(1, "Item is required"),
  sacCode: z.string().nullable().optional(),
  unitId: z.coerce.number().min(1, "Unit is required"),
  qty: z.coerce
    .number()
    .min(0.0001, "Quantity must be greater than 0")
    .max(9999999999.9999, "Quantity must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0.0001, "Rate must be greater than 0")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  cgst: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .default(0),
  sgst: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .default(0),
  igst: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .default(0),
  cgstAmt: z.coerce.number(),
  sgstAmt: z.coerce.number(),
  igstAmt: z.coerce.number(),
  amount: z.coerce.number(),
  executedQty: z.coerce.number().default(0),
  executedAmount: z.coerce.number().default(0),
  particulars: z.string().nullable().optional(),
});

const createSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required"),
  boqId: z.coerce.number().min(1, "BOQ is required"),
  subContractorId: z.coerce.number().min(1, "SubContractor is required"),
  vendorId: z.coerce.number().min(1, "Vendor is required"),
  billingAddressId: z.coerce.number().min(1, "Billing Address is required"),
  workOrderDate: z.string().transform((val) => new Date(val)),
  typeOfWorkOrder: z.string().min(1, "Type of Work Order is required"),
  quotationNo: z.string().optional().nullable(),
  quotationDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  paymentTermsInDays: z.coerce.number().optional().nullable(),
  deliveryDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  note: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  deliverySchedule: z.string().optional().nullable(),
  amountInWords: z.string().min(1, "Amount in words is required"),
  paymentTermIds: z.array(z.coerce.number()).min(1, "At least one payment term is required"),
  workOrderItems: z.array(workOrderItemSchema).min(1, "At least one item is required").superRefine((items, ctx) => {
    items.forEach((it, i) => {
      if (it.isBoqItem && (!it.boqItemId || it.boqItemId === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Activity is required for BOQ items', path: [i, 'boqItemId'] });
      }
      if (!it.item || String(it.item).trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Item is required', path: [i, 'item'] });
      }
    });
  }),
  totalAmount: z.coerce.number(),
  totalCgst: z.coerce.number().optional().nullable(),
  totalSgst: z.coerce.number().optional().nullable(),
  totalIgst: z.coerce.number().optional().nullable(),
  status: z.string().optional(),
});

const COMPANY_CODE = "SWO";

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

async function generateSWONumber(
  tx: Prisma.TransactionClient,
  _date: Date,
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
  // Build prefix as SWO/<FY>/<SITE>/ so final number becomes SWO/<FY>/<SITE>/<sequence>
  const prefix = `${COMPANY_CODE}/${financialYearLabel}/${site.siteCode}/`;
  const latest = await tx.subContractorWorkOrder.findFirst({
    where: {
      workOrderDate: { gte: startDate, lte: endDate },
      workOrderNo: { startsWith: prefix },
    },
    orderBy: { workOrderNo: "desc" },
    select: { workOrderNo: true },
  });
  const lastSequence = latest
    ? parseInt(latest.workOrderNo.slice(prefix.length), 10) || 0
    : 0;
  const nextSequence = (lastSequence + 1).toString().padStart(5, "0");
  return `${prefix}${nextSequence}`;
}

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const siteFilter = searchParams.get("site") || "";
    const subContractorFilter = searchParams.get("subContractor") || "";
    const statusFilter = searchParams.get("status") || "";
    const sort = (searchParams.get("sort") || "workOrderDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { workOrderNo: { contains: search } },
        { quotationNo: { contains: search } },
        { note: { contains: search } },
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

    if (subContractorFilter) {
      where.subContractor = { name: { contains: subContractorFilter } };
    }

    if (statusFilter) where.status = statusFilter;

    const sortableFields = new Set(["workOrderNo", "workOrderDate", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { workOrderDate: "desc" };

    const result = await paginate({
      model: prisma.subContractorWorkOrder as any,
      where,
      orderBy,
      page,
      perPage,
      include: {
        site: { select: { id: true, site: true } },
        subContractor: { select: { id: true, name: true } },
        vendor: { select: { id: true, vendorName: true } },
        createdBy: { select: { id: true, name: true } },
        approved1By: { select: { id: true, name: true } },
        approved2By: { select: { id: true, name: true } },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get SWO error:", error);
    return ApiError("Failed to fetch sub contractor work orders");
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const permSet = new Set((auth.user.permissions || []) as string[]);
    if (!permSet.has(PERMISSIONS.CREATE_SUB_CONTRACTOR_WORK_ORDERS)) {
      return BadRequest("Missing permission to create sub contractor work orders");
    }

    const body = await req.json();
    const parsedData = createSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const workOrderNo = await generateSWONumber(tx, parsedData.workOrderDate, { siteId: parsedData.siteId });

      const swo = await tx.subContractorWorkOrder.create({
        data: {
          workOrderNo,
          siteId: parsedData.siteId,
          boqId: parsedData.boqId,
          subContractorId: parsedData.subContractorId,
          billingAddressId: parsedData.billingAddressId,
          vendorId: parsedData.vendorId,
          workOrderDate: parsedData.workOrderDate,
          typeOfWorkOrder: parsedData.typeOfWorkOrder,
          quotationNo: parsedData.quotationNo,
          quotationDate: parsedData.quotationDate,
          paymentTermsInDays: parsedData.paymentTermsInDays,
          deliveryDate: parsedData.deliveryDate,
          note: parsedData.note,
          terms: parsedData.terms,
          deliverySchedule: parsedData.deliverySchedule,
          totalAmount: parsedData.totalAmount,
          totalCgst: parsedData.totalCgst,
          totalSgst: parsedData.totalSgst,
          totalIgst: parsedData.totalIgst,
          amountInWords: parsedData.amountInWords,
          status: parsedData.status ?? "DRAFT",
          createdById: auth.user.id,
          updatedById: auth.user.id,
          subContractorWorkOrderDetails: {
            create: parsedData.workOrderItems.map((item) => ({
              isBoqItem: item.isBoqItem,
              boqItemId: item.boqItemId,
              item: item.item,
              sacCode: item.sacCode,
              unitId: item.unitId,
              qty: item.qty,
              rate: item.rate,
              cgst: item.cgst,
              cgstAmt: item.cgstAmt,
              sgst: item.sgst,
              sgstAmt: item.sgstAmt,
              igst: item.igst,
              igstAmt: item.igstAmt,
              amount: item.amount,
              executedQty: item.executedQty,
              executedAmount: item.executedAmount,
              particulars: item.particulars,
            })),
          },
          subContractorWorkOrderPaymentTerms: {
            create: parsedData.paymentTermIds.map((ptId) => ({
              paymentTermId: ptId,
            })),
          },
        },
        include: {
          subContractorWorkOrderDetails: true,
          subContractorWorkOrderPaymentTerms: true,
        },
      });
      return swo;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    console.error("Create SWO error:", error);
    return ApiError("Failed to create sub contractor work order");
  }
}
