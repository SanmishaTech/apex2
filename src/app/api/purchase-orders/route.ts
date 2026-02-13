import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { amountInWords } from "@/lib/payroll";
import { z } from "zod";
import { ROLES } from "@/config/roles";

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
  indentItemId: z.coerce.number().optional(),
});

const createSchema = z.object({
  indentId: z.coerce.number().optional(),
  siteId: z.coerce.number().min(1, "Site is required"),
  vendorId: z.coerce.number().min(1, "Vendor is required"),
  billingAddressId: z.coerce.number().min(1, "Billing Address is required"),
  siteDeliveryAddressId: z.coerce
    .number()
    .min(1, "Site delivery address is required"),
  paymentTermIds: z
    .array(z.coerce.number())
    .optional()
    .transform((arr) =>
      Array.from(
        new Set(
          (arr || [])
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      )
    )
    .default([]),
  purchaseOrderDate: z.string().transform((val) => new Date(val)),
  deliveryDate: z.string().transform((val) => new Date(val)),
  quotationNo: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? val.trim() : null)),
  quotationDate: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? new Date(val) : null)),
  transport: z.string().optional(),
  note: z.string().optional(),
  terms: z.string().nullable().optional(),
  poStatus: z
    .preprocess(
      (v) => (v === null || v === "" ? undefined : v),
      z.enum(["ORDER_PLACED", "IN_TRANSIT", "RECEIVED", "HOLD", "OPEN"]).optional()
    )
    .optional(),
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
const SITE_CODE_MISSING_ERROR = "SITE_CODE_MISSING";

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
  _purchaseOrderDate: Date,
  opts: { siteId: number }
): Promise<string> {
  // Always use the server's current date to determine the financial year label
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

  const prefix = `${COMPANY_CODE}/${financialYearLabel}/${site.siteCode}/`;

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
    const excludeLinked = searchParams.get("excludeLinked") === "true";
    const approved2Filter = searchParams.get("approved2");
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

    // Site-based visibility: non-admin and non-projectDirector see only their assigned sites
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

    if (vendorFilter) {
      const vendorId = parseInt(vendorFilter);
      if (!isNaN(vendorId)) {
        where.vendorId = vendorId;
      }
    }

    // Optional filter for approval stage 2
    if (approved2Filter === "true") {
      where.isApproved2 = true;
    } else if (approved2Filter === "false") {
      where.isApproved2 = false;
    }

    if (excludeLinked) {
      // Only include POs that are not already linked in inward delivery challans
      where.inwardDeliveryChallan = { is: null };
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
        createdById: true,
        approved1ById: true,
        approved2ById: true,
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
      const paymentTermIds: number[] = (parsedData as any).paymentTermIds || [];
      const primaryPaymentTermId: number | null =
        paymentTermIds.length > 0 ? Number(paymentTermIds[0]) : null;

      // Generate financial year-based PO number within the transaction
      const purchaseOrderNo = await generatePONumber(
        tx,
        parsedData.purchaseOrderDate,
        { siteId: parsedData.siteId }
      );

      const poData: any = {
        purchaseOrderNo,
        purchaseOrderDate: parsedData.purchaseOrderDate,
        deliveryDate: parsedData.deliveryDate,
        siteId: parsedData.siteId,
        vendorId: parsedData.vendorId,
        billingAddressId: parsedData.billingAddressId,
        siteDeliveryAddressId: parsedData.siteDeliveryAddressId,
        paymentTermId: primaryPaymentTermId,
        quotationNo: (parsedData as any).quotationNo,
        note: parsedData.note || null,
        transport: parsedData.transport || null,
        quotationDate: (parsedData as any).quotationDate,
        transitInsuranceStatus: parsedData.transitInsuranceStatus || null,
        transitInsuranceAmount: parsedData.transitInsuranceAmount || null,
        pfStatus: parsedData.pfStatus || null,
        pfCharges: parsedData.pfCharges || null,
        gstReverseStatus: parsedData.gstReverseStatus || null,
        gstReverseAmount: parsedData.gstReverseAmount || null,
        terms: null,
        poStatus: parsedData.poStatus ?? undefined,
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
              siteCode: true,
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
          poPaymentTerms: {
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
        await tx.pOPaymentTerm.createMany({
          data: paymentTermIds.map((paymentTermId) => ({
            purchaseOrderId: purchaseOrder.id,
            paymentTermId,
          })),
          skipDuplicates: true,
        });
      }

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
        const linkedDetailIds = new Set<number>();
        const itemsWithIndentReference = parsedData.purchaseOrderItems
          .map((item, index) => ({
            indentItemId: item.indentItemId,
            detail: createdPODetails[index],
          }))
          .filter(
            ({ indentItemId }) =>
              typeof indentItemId === "number" && Number.isFinite(indentItemId)
          ) as {
          indentItemId: number;
          detail: (typeof createdPODetails)[number];
        }[];

        if (itemsWithIndentReference.length > 0) {
          const indentItemIds = itemsWithIndentReference.map(
            ({ indentItemId }) => indentItemId
          );

          const availableIndentItems = await tx.indentItem.findMany({
            where: {
              id: { in: indentItemIds },
              indentId: parsedData.indentId,
            },
            select: { id: true },
          });

          const validIndentItemIds = new Set(
            availableIndentItems.map((item) => item.id)
          );

          for (const { indentItemId, detail } of itemsWithIndentReference) {
            if (validIndentItemIds.has(indentItemId)) {
              await tx.indentItem.update({
                where: { id: indentItemId },
                data: { purchaseOrderDetailId: detail.id },
              });
              linkedDetailIds.add(detail.id);
            }
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
          poPaymentTerms: {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error instanceof Error && error.message === SITE_CODE_MISSING_ERROR) {
      return BadRequest(
        "Site Code is not added. Please add Site Code to generate the Purchase Order Number."
      );
    }
    if (error.code === "P2002") {
      return ApiError("Purchase order number already exists", 409);
    }
    if (error?.message && typeof error.message === "string") {
      if (error.message.startsWith("BAD_REQUEST:")) {
        return BadRequest(error.message.replace(/^BAD_REQUEST:\s*/i, ""));
      }
    }
    console.error("Create purchase order error:", error);
    return ApiError("Failed to create purchase order");
  }
}
