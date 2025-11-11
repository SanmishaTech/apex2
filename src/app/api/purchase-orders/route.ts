import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";

const purchaseOrderItemSchema = z.object({
  itemId: z.coerce.number().min(1, "Item is required"),
  remark: z.string().nullable().optional(),
  qty: z.coerce
    .number()
    .min(0.0001, "Quantity must be greater than 0")
    .max(9999999999.9999, "Quantity must be <= 9,999,999,999.9999"),
  rate: z.coerce
    .number()
    .min(0, "Rate must be non-negative")
    .max(9999999999.99, "Rate must be <= 9,999,999,999.99"),
  discountPercent: z.coerce
    .number()
    .min(0, "Discount % must be non-negative")
    .max(100, "Discount % must be <= 100")
    .default(0),
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
  disAmt: z.coerce.number(),
  cgstAmt: z.coerce.number(),
  sgstAmt: z.coerce.number(),
  igstAmt: z.coerce.number(),
  amount: z.coerce.number(),
});

const createSchema = z.object({
  indentId: z.coerce.number().optional(),
  siteId: z.coerce.number().min(1, "Site is required"),
  vendorId: z.coerce.number().min(1, "Vendor is required"),
  billingAddressId: z.coerce.number().min(1, "Billing Address is required"),
  siteDeliveryAddressId: z.coerce
    .number()
    .min(1, "Site delivery address is required"),
  paymentTermId: z.coerce.number().optional(),
  purchaseOrderDate: z.string().transform((val) => new Date(val)),
  deliveryDate: z.string().transform((val) => new Date(val)),
  quotationNo: z.string().min(1, "Quotation No. is required"),
  quotationDate: z.string().transform((val) => new Date(val)),
  transport: z.string().optional(),
  note: z.string().optional(),
  terms: z.string().optional(),
  poStatus: z.enum(["HOLD"]).optional().nullable(),
  paymentTermsInDays: z.coerce.number().optional(),
  transitInsuranceStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  transitInsuranceAmount: z.string().nullable().optional(),
  pfStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  pfCharges: z.string().nullable().optional(),
  gstReverseStatus: z
    .enum(["EXCLUSIVE", "INCLUSIVE", "NOT_APPLICABLE"])
    .nullable()
    .optional(),
  gstReverseAmount: z.string().nullable().optional(),
  deliverySchedule: z.string().optional(),
  amount: z.coerce.number(),
  totalCgstAmount: z.coerce.number(),
  totalSgstAmount: z.coerce.number(),
  totalIgstAmount: z.coerce.number(),
  purchaseOrderItems: z
    .array(purchaseOrderItemSchema)
    .min(1, "At least one item is required"),
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

async function generatePONumber(
  tx: Prisma.TransactionClient,
  purchaseOrderDate: Date
): Promise<string> {
  const { startDate, endDate, financialYearLabel } =
    getFinancialYearInfo(purchaseOrderDate);

  const prefix = `${COMPANY_CODE}/${financialYearLabel}/`;

  const latestPO = await tx.purchaseOrder.findFirst({
    where: {
      purchaseOrderDate: {
        gte: startDate,
        lte: endDate,
      },
      purchaseOrderNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      purchaseOrderNo: "desc",
    },
    select: {
      purchaseOrderNo: true,
    },
  });

  const lastSequence = latestPO
    ? parseInt(latestPO.purchaseOrderNo.slice(prefix.length), 10) || 0
    : 0;

  const nextSequence = (lastSequence + 1).toString().padStart(5, "0");

  return `${prefix}${nextSequence}`;
}

// GET /api/purchase-orders?search=&page=1&perPage=10&sort=purchaseOrderDate&order=desc&site=&vendor=
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
    const sort = (searchParams.get("sort") || "purchaseOrderDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { purchaseOrderNo: { contains: search } },
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
      "purchaseOrderNo",
      "purchaseOrderDate",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { purchaseOrderDate: "desc" };

    const result = await paginate({
      model: prisma.purchaseOrder as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        purchaseOrderNo: true,
        purchaseOrderDate: true,
        deliveryDate: true,
        siteId: true,
        vendorId: true,
        quotationNo: true,
        quotationDate: true,
        amount: true,
        amountInWords: true,
        approvalStatus: true,
        isSuspended: true,
        isComplete: true,
        poStatus: true,
        note: true,
        remarks: true,
        billStatus: true,
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
        purchaseOrderDetails: {
          select: {
            id: true,
            itemId: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                item: true,
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
    console.error("Get purchase orders error:", error);
    return ApiError("Failed to fetch purchase orders");
  }
}

// POST /api/purchase-orders - Create new purchase order
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsedData = createSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Generate financial year-based PO number within the transaction
      const purchaseOrderNo = await generatePONumber(
        tx,
        parsedData.purchaseOrderDate
      );

      const poData: Prisma.PurchaseOrderUncheckedCreateInput = {
        purchaseOrderNo,
        purchaseOrderDate: parsedData.purchaseOrderDate,
        deliveryDate: parsedData.deliveryDate,
        siteId: parsedData.siteId,
        vendorId: parsedData.vendorId,
        billingAddressId: parsedData.billingAddressId,
        siteDeliveryAddressId: parsedData.siteDeliveryAddressId,
        paymentTermId: parsedData.paymentTermId || null,
        quotationNo: parsedData.quotationNo,
        note: parsedData.note || null,
        transport: parsedData.transport || null,
        quotationDate: parsedData.quotationDate,
        transitInsuranceStatus: parsedData.transitInsuranceStatus || null,
        transitInsuranceAmount: parsedData.transitInsuranceAmount || null,
        pfStatus: parsedData.pfStatus || null,
        pfCharges: parsedData.pfCharges || null,
        gstReverseStatus: parsedData.gstReverseStatus || null,
        gstReverseAmount: parsedData.gstReverseAmount || null,
        terms: parsedData.terms || null,
        poStatus: parsedData.poStatus ?? null,
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
        indentId: parsedData.indentId || null,
      };

      const purchaseOrder = await tx.purchaseOrder.create({
        data: poData,
        select: {
          id: true,
          purchaseOrderNo: true,
          purchaseOrderDate: true,
          deliveryDate: true,
          siteId: true,
          vendorId: true,
          billingAddressId: true,
          siteDeliveryAddressId: true,
          paymentTermId: true,
          quotationNo: true,
          quotationDate: true,
          transport: true,
          note: true,
          terms: true,
          poStatus: true,
          paymentTermsInDays: true,
          deliverySchedule: true,
          amount: true,
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
          paymentTerm: {
            select: {
              id: true,
              paymentTerm: true,
              description: true,
            },
          },
        },
      });

      // Create PO items
      const poId = purchaseOrder.id;
      const itemsData = parsedData.purchaseOrderItems.map((item, index) => ({
        purchaseOrderId: poId,
        serialNo: index + 1,
        itemId: item.itemId,
        remark: item.remark || null,
        qty: item.qty,
        orderedQty: item.qty,
        rate: item.rate,
        discountPercent: item.discountPercent,
        disAmt: item.disAmt,
        cgstPercent: item.cgstPercent,
        cgstAmt: item.cgstAmt,
        sgstPercent: item.sgstPercent,
        sgstAmt: item.sgstAmt,
        igstPercent: item.igstPercent,
        igstAmt: item.igstAmt,
        amount: item.amount,
      }));

      const createdPODetails = await Promise.all(
        itemsData.map(async (itemData) => {
          return await tx.purchaseOrderDetail.create({
            data: itemData,
          });
        })
      );

      // If this PO is created from an indent, update the indent items with purchase order detail IDs
      if (parsedData.indentId) {
        const indentItems = await tx.indentItem.findMany({
          where: { indentId: parsedData.indentId },
          orderBy: { id: 'asc' }
        });

        // Match indent items with PO details by itemId and update the purchaseOrderDetailId
        for (let i = 0; i < createdPODetails.length && i < indentItems.length; i++) {
          const poDetail = createdPODetails[i];
          const indentItem = indentItems.find(item => item.itemId === poDetail.itemId);
          
          if (indentItem) {
            await tx.indentItem.update({
              where: { id: indentItem.id },
              data: { purchaseOrderDetailId: poDetail.id }
            });
          }
        }
      }

      // Fetch the created PO with items
      const poWithItems = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        select: {
          id: true,
          purchaseOrderNo: true,
          purchaseOrderDate: true,
          deliveryDate: true,
          siteId: true,
          vendorId: true,
          billingAddressId: true,
          siteDeliveryAddressId: true,
          paymentTermId: true,
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
          paymentTerm: {
            select: {
              id: true,
              paymentTerm: true,
              description: true,
            },
          },
          purchaseOrderDetails: {
            select: {
              id: true,
              serialNo: true,
              itemId: true,
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  item: true,
                },
              },
              remark: true,
              qty: true,
              rate: true,
              discountPercent: true,
              disAmt: true,
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

      return poWithItems;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return ApiError("Purchase order number already exists", 409);
    }
    console.error("Create purchase order error:", error);
    return ApiError("Failed to create purchase order");
  }
}
