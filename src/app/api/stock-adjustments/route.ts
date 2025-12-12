import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const createSchema = z.object({
  date: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: "Invalid date" }),
  siteId: z.number().int().positive("Site ID is required"),
  remarks: z.string().max(255).optional().nullable(),
  stockAdjustmentDetails: z
    .array(
      z.object({
        itemId: z.number().int().positive("Item ID is required"),
        issuedQty: z.number().min(0).default(0),
        receivedQty: z.number().min(0).default(0),
        rate: z.number().min(0).default(0),
        amount: z.number().min(0).default(0),
        remarks: z.string().max(255).optional().nullable(),
      })
    )
    .min(1, "At least one detail is required"),
});

// GET /api/stock-adjustments?page=1&perPage=10&siteId=...
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
    const search = (searchParams.get("search") || "").trim();
    const sort = (searchParams.get("sort") || "date").trim();
    const order = (
      (searchParams.get("order") || "desc").trim().toLowerCase() === "asc"
        ? "asc"
        : "desc"
    ) as "asc" | "desc";

    const siteIdParam = searchParams.get("siteId");
    const where: Prisma.StockAdjustmentWhereInput = {};
    if (siteIdParam && !isNaN(Number(siteIdParam))) {
      where.siteId = Number(siteIdParam);
    }

    // Optional: filter by date range
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      const gte = from && !isNaN(Date.parse(from)) ? new Date(from) : undefined;
      const lte = to && !isNaN(Date.parse(to)) ? new Date(to) : undefined;
      where.date = {
        ...(gte ? { gte } : {}),
        ...(lte ? { lte } : {}),
      } as any;
    }

    // search support
    if (search) {
      const searchNum = Number(search);
      const isNum = !isNaN(searchNum);
      (where as any).OR = [
        { site: { site: { contains: search, mode: "insensitive" } } },
        { createdBy: { name: { contains: search, mode: "insensitive" } } },
        ...(isNum ? ([{ id: { equals: searchNum } }] as any) : []),
      ];
    }

    // sorting support
    let orderBy: any = { date: "desc" };
    if (sort === "date") orderBy = { date: order };
    else if (sort === "createdAt") orderBy = { createdAt: order };
    else if (sort === "site") orderBy = { site: { site: order } };
    else if (sort === "createdBy") orderBy = { createdBy: { name: order } };

    const result = await paginate({
      model: prisma.stockAdjustment as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        date: true,
        siteId: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get stock adjustments error:", error);
    return ApiError("Failed to fetch stock adjustments");
  }
}

// POST /api/stock-adjustments - Create new Stock Adjustment
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const payload = await req.json();
    const validated = createSchema.parse(payload);

    const userId = (auth as any).user?.id as number;
    const { stockAdjustmentDetails, siteId } = validated as any;

    // convert date string to Date with current time components
    const txnDate = (() => {
      const base = new Date(validated.date);
      const now = new Date();
      base.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );
      return base;
    })();

    const created = await prisma.$transaction(async (tx) => {
      // Create main adjustment
      const main = await tx.stockAdjustment.create({
        data: {
          date: txnDate,
          site: { connect: { id: validated.siteId } },
          createdBy: { connect: { id: userId } },
          updatedBy: { connect: { id: userId } },
        },
        select: { id: true, siteId: true, date: true },
      });

      // Create details
      if (
        Array.isArray(stockAdjustmentDetails) &&
        stockAdjustmentDetails.length > 0
      ) {
        const detailsCreate = stockAdjustmentDetails.map((d: any) => ({
          stockAdjustmentId: main.id,
          itemId: Number(d.itemId),
          issuedQty: Number(d.issuedQty || 0),
          receivedQty: Number(d.receivedQty || 0),
          rate: Number(d.rate || 0),
          amount: Number(d.amount || 0),
          remarks: (d.remarks ?? null) as string | null,
        }));
        await tx.stockAdjustmentDetail.createMany({ data: detailsCreate });

        // Determine if the site has any prior stock ledger records
        const siteLedgerCount = await tx.stockLedger.count({
          where: { siteId: Number(siteId) },
        });

        // For each detail: create ledger entries (separate rows for received and issued with appropriate unit rates)
        // and update SiteItem per rules
        for (const d of detailsCreate) {
          const receivedQty = Number(d.receivedQty || 0);
          const issuedQty = Number(d.issuedQty || 0);
          const payloadRate = Number(d.rate || 0);
          const payloadAmount = Number(d.amount || 0);

          // Fetch current site item to get existing unitRate for issue and current closing
          const existing = await tx.siteItem.findFirst({
            where: { siteId: Number(siteId), itemId: Number(d.itemId) },
            select: {
              id: true,
              closingStock: true,
              closingValue: true,
              unitRate: true,
            },
          });

          // Ledger: received
          if (receivedQty > 0) {
            await tx.stockLedger.create({
              data: {
                siteId: Number(siteId),
                transactionDate: txnDate,
                itemId: Number(d.itemId),
                stockAdjustmentId: main.id,
                receivedQty: receivedQty,
                issuedQty: 0,
                unitRate: payloadRate,
                documentType: "STOCK ADJUSTMENT",
              } as any,
            });
          }

          // Ledger: issued (use payload rate in ledger unitRate)
          if (issuedQty > 0) {
            await tx.stockLedger.create({
              data: {
                siteId: Number(siteId),
                transactionDate: txnDate,
                itemId: Number(d.itemId),
                stockAdjustmentId: main.id,
                receivedQty: 0,
                issuedQty: issuedQty,
                unitRate: payloadRate,
                documentType: "STOCK ADJUSTMENT",
              } as any,
            });
          }

          // Compute new SiteItem values
          // Step 1: apply receive per site ledger rule
          let baseStock = Number(existing?.closingStock || 0);
          let baseValue = Number(existing?.closingValue || 0);
          let baseUnitRate = Number(existing?.unitRate || 0);
          if (receivedQty > 0) {
            if (siteLedgerCount === 0) {
              baseStock = Number(receivedQty.toFixed(4));
              baseValue = Number(payloadAmount.toFixed(2));
              baseUnitRate = Number(payloadRate.toFixed(4));
            } else {
              baseStock = Number((baseStock + receivedQty).toFixed(4));
              baseValue = Number((baseValue + payloadAmount).toFixed(2));
              baseUnitRate =
                baseStock !== 0
                  ? Number((baseValue / baseStock).toFixed(4))
                  : baseUnitRate;
            }
          }

          // Step 2: apply issue (unitRate will be recomputed)
          if (issuedQty > 0) {
            const prevValue = baseValue;
            baseStock = Number((baseStock - issuedQty).toFixed(4));
            baseValue = Number((prevValue - payloadAmount).toFixed(2));
            baseUnitRate =
              baseStock !== 0 ? Number((baseValue / baseStock).toFixed(4)) : 0;
          }

          // Persist SiteItem
          if (!existing) {
            await tx.siteItem.create({
              data: {
                siteId: Number(siteId),
                itemId: Number(d.itemId),
                closingStock: baseStock,
                closingValue: baseValue,
                unitRate: baseUnitRate,
                log:
                  issuedQty > 0 && receivedQty === 0
                    ? "SA Issue Init"
                    : receivedQty > 0
                    ? "SA Init"
                    : "SA Init",
              } as any,
            });
          } else {
            await tx.siteItem.update({
              where: { id: existing.id },
              data: {
                closingStock: baseStock,
                closingValue: baseValue,
                unitRate: baseUnitRate,
                log:
                  issuedQty > 0 && receivedQty === 0
                    ? "SA Issue Update"
                    : receivedQty > 0
                    ? "SA Update"
                    : "SA Update",
              } as any,
            });
          }
        }
      }

      return main;
    });

    return Success(created, 201);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create stock adjustment error:", error);
    return ApiError("Failed to create stock adjustment");
  }
}
