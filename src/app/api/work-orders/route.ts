import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";
import { PERMISSIONS } from "@/config/roles";

const workOrderItemSchema = z.object({
  serialNo: z.coerce.number().min(1, "Sr. No. is required").optional(),
  Item: z.string().min(1, "Item is required"),
  unitId: z.coerce.number().min(1, "Unit is required"),
  sac_code: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
  qty: z.coerce
    .number()
    .min(0.0001, "Quantity must be greater than 0")
    .max(9999999999.9999, "Quantity must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  cgstPercent: z.coerce
    .number()
    .min(0, "CGST % must be non-negative")
    .max(100, "CGST % must be <= 100")
    .default(0),
  sgstPercent: z.coerce
    .number()
    .min(0, "SGST % must be non-negative")
    .max(100, "SGST % must be <= 100")
    .default(0),
  igstPercent: z.coerce
    .number()
    .min(0, "IGST % must be non-negative")
    .max(100, "IGST % must be <= 100")
    .default(0),
  cgstAmt: z.coerce.number(),
  sgstAmt: z.coerce.number(),
  igstAmt: z.coerce.number(),
  amount: z.coerce.number(),
});

const createSchema = z.object({
  purchaseOrderId: z.coerce.number().min(1, "Purchase Order is required"),
  boqId: z.coerce.number().min(1, "BOQ is required"),
  siteId: z.coerce.number().min(1, "Site is required"),
  vendorId: z.coerce.number().min(1, "Vendor is required"),
  billingAddressId: z.coerce.number().min(1, "Billing Address is required"),
  siteDeliveryAddressId: z.coerce
    .number()
    .min(1, "Site delivery address is required"),
  paymentTermIds: z
    .array(z.union([z.string(), z.number()]).transform((v) => String(v)))
    .optional()
    .default([]),
  type: z.enum(["SUB_CONTRACT", "PWR_WORK"]),
  workOrderDate: z.string().transform((val) => new Date(val)),
  deliveryDate: z.string().transform((val) => new Date(val)),
  quotationNo: z.string().min(1, "Quotation No. is required"),
  quotationDate: z.string().transform((val) => new Date(val)),
  transport: z.string().optional(),
  note: z.string().optional(),
  terms: z.string().optional(),
  woStatus: z.enum(["HOLD"]).optional().nullable(),
  paymentTermsInDays: z.coerce.number().optional(),
  deliverySchedule: z.string().optional(),
  workOrderItems: z
    .array(workOrderItemSchema)
    .min(1, "At least one item is required"),
  amount: z.coerce.number(),
  totalCgstAmount: z.coerce.number(),
  totalSgstAmount: z.coerce.number(),
  totalIgstAmount: z.coerce.number(),
});

const COMPANY_CODE = "DCTPL";

function normalizeYear(year: number): number {
  if (!Number.isFinite(year)) {
    return new Date().getFullYear();
  }

  if (year < 100) {
    return 2000 + year; // treat 2-digit years as 20xx
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
  const startYear = month >= 3 ? year : year - 1; // Financial year starts in April
  const endYear = startYear + 1;

  const startDate = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)); // 1 April (00:00 UTC)
  const endDate = new Date(Date.UTC(endYear, 3, 0, 23, 59, 59, 999)); // 31 March (23:59 UTC)

  const formatYear = (y: number) =>
    normalizeYear(y).toString().slice(-2).padStart(2, "0");
  const financialYearLabel = `${formatYear(startYear)}-${formatYear(endYear)}`;

  return {
    startDate,
    endDate,
    financialYearLabel,
  };
}

async function generateWONumber(
  tx: Prisma.TransactionClient,
  _workOrderDate: Date
): Promise<string> {
  // New format: AAAA-BBB (e.g., 0001-001 ... 0001-999, 0002-001 ...)
  // We sort by workOrderNo desc; lexicographic works due to fixed widths.
  // Fetch recent candidates and pick the most recent strictly matching NNNN-NNN
  const candidates = await tx.workOrder.findMany({
    where: {
      workOrderNo: {
        contains: "-",
      },
    },
    orderBy: { workOrderNo: "desc" },
    select: { workOrderNo: true },
    take: 50,
  });
  const latestWO = candidates.find((c) => /^\d{4}-\d{3}$/.test(c.workOrderNo));

  let left = 1;
  let right = 1;

  if (latestWO?.workOrderNo) {
    const parts = latestWO.workOrderNo.split("-");
    if (parts.length === 2) {
      const prevLeft = parseInt(parts[0], 10);
      const prevRight = parseInt(parts[1], 10);
      if (Number.isFinite(prevLeft) && Number.isFinite(prevRight)) {
        left = prevLeft;
        right = prevRight + 1;
        if (right > 999) {
          left = left + 1;
          right = 1;
        }
      }
    }
  }

  const leftStr = String(left).padStart(4, "0");
  const rightStr = String(right).padStart(3, "0");
  return `${leftStr}-${rightStr}`;
}

// GET /api/work-orders?search=&page=1&perPage=10&sort=workOrderDate&order=desc&site=&vendor=
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
    const vendorFilter = searchParams.get("vendor") || "";
    const sort = (searchParams.get("sort") || "workOrderDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { workOrderNo: { contains: search } },
        { quotationNo: { contains: search } },
        { note: { contains: search } },
      ];
    }

    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        where.siteId = siteId;
      }
    }

    if (vendorFilter) {
      const vendorId = parseInt(vendorFilter);
      if (!isNaN(vendorId)) {
        where.vendorId = vendorId;
      }
    }

    const sortableFields = new Set([
      "workOrderNo",
      "workOrderDate",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { workOrderDate: "desc" };

    const result = await paginate({
      model: prisma.workOrder as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        workOrderNo: true,
        workOrderDate: true,
        deliveryDate: true,
        siteId: true,
        vendorId: true,
        createdById: true,
        approved1ById: true,
        approved2ById: true,
        quotationNo: true,
        quotationDate: true,
        amount: true,
        amountInWords: true,
        approvalStatus: true,
        isSuspended: true,
        isComplete: true,
        woStatus: true,
        note: true,
        remarks: true,
        billStatus: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        approved1By: {
          select: {
            id: true,
            name: true,
          },
        },
        approved2By: {
          select: {
            id: true,
            name: true,
          },
        },
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        vendor: {
          select: {
            id: true,
            vendorName: true,
          },
        },
        workOrderDetails: {
          select: {
            id: true,
            serialNo: true,
            Item: true,
            unitId: true,
            unit: {
              select: {
                id: true,
                unitName: true,
              },
            },
            qty: true,
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
    console.error("Get work orders error:", error);
    return ApiError("Failed to fetch work orders");
  }
}

// POST /api/work-orders - Create new work order
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const permSet = new Set((auth.user.permissions || []) as string[]);
    if (!permSet.has(PERMISSIONS.CREATE_WORK_ORDERS)) {
      throw new Error("BAD_REQUEST: Missing permission to create work orders");
    }

    const body = await req.json();
    const parsedData = createSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const paymentTermIds: number[] = Array.isArray(
        (parsedData as any).paymentTermIds
      )
        ? Array.from(
            new Set(
              ((parsedData as any).paymentTermIds as any[])
                .map((v) => Number(v))
                .filter((n) => Number.isFinite(n) && n > 0)
            )
          )
        : [];

      // Generate financial year-based WO number within the transaction
      const workOrderNo = await generateWONumber(tx, parsedData.workOrderDate);

      const woData: Prisma.WorkOrderUncheckedCreateInput = {
        workOrderNo,
        type: parsedData.type,
        workOrderDate: parsedData.workOrderDate,
        deliveryDate: parsedData.deliveryDate,
        purchaseOrderId: parsedData.purchaseOrderId,
        boqId: parsedData.boqId,
        siteId: parsedData.siteId,
        vendorId: parsedData.vendorId,
        billingAddressId: parsedData.billingAddressId,
        siteDeliveryAddressId: parsedData.siteDeliveryAddressId,
        quotationNo: parsedData.quotationNo,
        note: parsedData.note || null,
        transport: parsedData.transport || null,
        quotationDate: parsedData.quotationDate,
        terms: parsedData.terms || null,
        woStatus: parsedData.woStatus ?? null,
        paymentTermsInDays: parsedData.paymentTermsInDays || null,
        deliverySchedule: parsedData.deliverySchedule || null,
        amount: parsedData.amount,
        amountInWords: amountInWords(parsedData.amount),
        totalCgstAmount: parsedData.totalCgstAmount,
        totalSgstAmount: parsedData.totalSgstAmount,
        totalIgstAmount: parsedData.totalIgstAmount,
        approvalStatus: "DRAFT",
        createdById: auth.user.id,
        updatedById: auth.user.id,
      };

      const workOrder = await tx.workOrder.create({
        data: woData,
        select: {
          id: true,
          workOrderNo: true,
          type: true,
          workOrderDate: true,
          deliveryDate: true,
          quotationNo: true,
          quotationDate: true,
          transport: true,
          note: true,
          terms: true,
          woStatus: true,
          paymentTermsInDays: true,
          deliverySchedule: true,
          amount: true,
          totalCgstAmount: true,
          totalSgstAmount: true,
          totalIgstAmount: true,
          approvalStatus: true,
          isSuspended: true,
          isComplete: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          vendor: {
            select: {
              id: true,
              vendorName: true,
            },
          },
          billingAddress: {
            select: {
              id: true,
              companyName: true,
              city: true,
            },
          },
          siteDeliveryAddress: {
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              cityId: true,
              stateId: true,
              pinCode: true,
            },
          },
          WOPaymentTerms: {
            select: {
              paymentTermId: true,
              paymentTerm: {
                select: {
                  id: true,
                  paymentTerm: true,
                  description: true,
                },
              },
            },
          },
        },
      });

      if (paymentTermIds.length > 0) {
        await (tx as any).wOPaymentTerm.createMany({
          data: paymentTermIds.map((paymentTermId) => ({
            workOrderId: workOrder.id,
            paymentTermId,
          })),
          skipDuplicates: true,
        });
      }

      // Create WO items
      const woId = workOrder.id;
      const itemsData = parsedData.workOrderItems.map((item, index) => ({
        workOrderId: woId,
        serialNo:
          typeof (item as any).serialNo === "number" &&
          Number.isFinite(Number((item as any).serialNo))
            ? Number((item as any).serialNo)
            : index + 1,
        Item: (item as any).Item,
        unitId: (item as any).unitId,
        sac_code: (item as any).sac_code || null,
        remark: item.remark || null,
        qty: item.qty,
        orderedQty: item.qty,
        rate: item.rate,
        cgstPercent: item.cgstPercent,
        cgstAmt: item.cgstAmt,
        sgstPercent: item.sgstPercent,
        sgstAmt: item.sgstAmt,
        igstPercent: item.igstPercent,
        igstAmt: item.igstAmt,
        amount: item.amount,
      }));

      await Promise.all(
        itemsData.map(async (itemData) => {
          return await tx.workOrderDetail.create({
            data: itemData,
          });
        })
      );

      // Fetch the created WO with items
      const woWithItems = await tx.workOrder.findUnique({
        where: { id: woId },
        select: {
          id: true,
          workOrderNo: true,
          workOrderDate: true,
          deliveryDate: true,
          purchaseOrderId: true,
          boqId: true,
          siteId: true,
          vendorId: true,
          billingAddressId: true,
          siteDeliveryAddressId: true,
          quotationNo: true,
          quotationDate: true,
          transport: true,
          note: true,
          terms: true,
          paymentTermsInDays: true,
          deliverySchedule: true,
          amount: true,
          totalCgstAmount: true,
          totalSgstAmount: true,
          totalIgstAmount: true,
          amountInWords: true,
          approvalStatus: true,
          isSuspended: true,
          isComplete: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          vendor: {
            select: {
              id: true,
              vendorName: true,
            },
          },
          billingAddress: {
            select: {
              id: true,
              companyName: true,
              city: true,
            },
          },
          WOPaymentTerms: {
            select: {
              paymentTermId: true,
              paymentTerm: {
                select: {
                  id: true,
                  paymentTerm: true,
                  description: true,
                },
              },
            },
          },
          workOrderDetails: {
            select: {
              id: true,
              serialNo: true,
              Item: true,
              unitId: true,
              unit: {
                select: {
                  id: true,
                  unitName: true,
                },
              },
              sac_code: true,
              remark: true,
              qty: true,
              rate: true,
              cgstPercent: true,
              cgstAmt: true,
              sgstPercent: true,
              sgstAmt: true,
              igstPercent: true,
              igstAmt: true,
              amount: true,
            },
            orderBy: {
              serialNo: "asc",
            },
          },
        },
      });

      return woWithItems;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return ApiError("Work order number already exists", 409);
    }
    console.error("Create work order error:", error);
    return ApiError("Failed to create work order");
  }
}
