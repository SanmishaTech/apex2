import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ROLES } from "@/config/roles";

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
        saDetailBatches: z
          .array(
            z.object({
              batchNumber: z.string().optional().default(""),
              batchExpiryDate: z.string().optional().default(""),
              batchIssuedQty: z.number().min(0).default(0),
              batchReceivedQty: z.number().min(0).default(0),
              batchUnitRate: z.number().min(0).optional().default(0),
            })
          )
          .optional()
          .default([]),
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

    // Site-based visibility: only ADMIN can see all; others limited to assigned sites
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      const inIds = assignedSiteIds.length > 0 ? assignedSiteIds : [-1];
      if (siteIdParam && !isNaN(Number(siteIdParam))) {
        const requested = Number(siteIdParam);
        (where as any).siteId = inIds.includes(requested) ? requested : -1;
      } else {
        (where as any).siteId = { in: inIds } as any;
      }
    }

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
          saDetailBatches: Array.isArray(d?.saDetailBatches) ? d.saDetailBatches : [],
        }));

        // Validate batches against SiteItemBatch closing (server-side source of truth)
        const errors: string[] = [];
        const allBatchReq = detailsCreate
          .flatMap((d: any) =>
            (d.saDetailBatches || []).map((b: any) => ({
              itemId: Number(d.itemId),
              batchNumber: String(b?.batchNumber || "").trim(),
              batchExpiryDate: String(b?.batchExpiryDate || "").trim(),
              batchIssuedQty: Number(b?.batchIssuedQty ?? 0),
              batchReceivedQty: Number(b?.batchReceivedQty ?? 0),
              batchUnitRate: Number(b?.batchUnitRate ?? 0),
            }))
          )
          .filter(
            (b: any) =>
              !!b.batchNumber &&
              (Number(b.batchIssuedQty) > 0 || Number(b.batchReceivedQty) > 0)
          );

        for (const b of allBatchReq) {
          if (Number(b.batchIssuedQty) > 0 && Number(b.batchReceivedQty) > 0) {
            errors.push(
              `Item ${b.itemId} / Batch ${b.batchNumber}: Enter either issued or received`
            );
          }
        }

        if (allBatchReq.length > 0) {
          const uniqueKeys = Array.from(
            new Set(allBatchReq.map((b: any) => `${b.itemId}::${b.batchNumber}`))
          );
          const batches = await tx.siteItemBatch.findMany({
            where: {
              siteId: Number(siteId),
              OR: uniqueKeys.map((k) => {
                const [itemIdStr, batchNumber] = String(k).split("::");
                return { itemId: Number(itemIdStr), batchNumber: String(batchNumber) };
              }),
            },
            select: {
              id: true,
              itemId: true,
              siteItemId: true,
              batchNumber: true,
              expiryDate: true,
              closingQty: true,
              unitRate: true,
              closingValue: true,
            },
          });

          const byKey = new Map<string, any>();
          for (const b of batches) {
            byKey.set(`${Number(b.itemId)}::${String(b.batchNumber)}`, b);
          }

          const issuedByKey = new Map<string, number>();
          for (const r of allBatchReq) {
            const key = `${Number(r.itemId)}::${String(r.batchNumber)}`;
            const prev = issuedByKey.get(key) || 0;
            issuedByKey.set(
              key,
              Number((prev + Number(r.batchIssuedQty || 0)).toFixed(4))
            );
          }

          for (const [key, reqIssued] of issuedByKey.entries()) {
            if (!(reqIssued > 0)) continue;
            const existing = byKey.get(key);
            if (!existing) {
              errors.push(`Batch not found: ${key.replace("::", " / ")}`);
              continue;
            }
            const closing = Number(existing.closingQty ?? 0);
            if (reqIssued > closing) {
              errors.push(
                `Batch ${key.replace("::", " / ")}: Issued qty cannot exceed batch closing (${closing})`
              );
            }
          }

          // Expiry date validation: required for NEW batches when receiving
          for (const r of allBatchReq) {
            const key = `${Number(r.itemId)}::${String(r.batchNumber)}`;
            const existing = byKey.get(key);
            const receivedQty = Number(r.batchReceivedQty || 0);
            if (!existing && receivedQty > 0) {
              const exp = String(r.batchExpiryDate || "").trim();
              if (!/^\d{4}-\d{2}$/.test(exp)) {
                errors.push(
                  `Item ${r.itemId} / Batch ${r.batchNumber}: Expiry date is required (YYYY-MM)`
                );
              }
            }
          }
        }

        if (errors.length > 0) {
          return BadRequest({ message: "Validation failed", details: errors } as any) as any;
        }

        // Create details individually so we can create StockAdjustmentDetailBatch
        const createdDetails: Array<{
          id: number;
          itemId: number;
          issuedQty: number;
          receivedQty: number;
          rate: number;
          amount: number;
          saDetailBatches: any[];
        }> = [];

        for (const d of detailsCreate) {
          const createdDetail = await tx.stockAdjustmentDetail.create({
            data: {
              stockAdjustmentId: d.stockAdjustmentId,
              itemId: Number(d.itemId),
              issuedQty: Number(d.issuedQty || 0),
              receivedQty: Number(d.receivedQty || 0),
              rate: Number(d.rate || 0),
              amount: Number(d.amount || 0),
              remarks: (d.remarks ?? null) as string | null,
            },
            select: {
              id: true,
              itemId: true,
              issuedQty: true,
              receivedQty: true,
              rate: true,
              amount: true,
            },
          });
          createdDetails.push({
            id: createdDetail.id,
            itemId: Number(createdDetail.itemId),
            issuedQty: Number(createdDetail.issuedQty ?? 0),
            receivedQty: Number(createdDetail.receivedQty ?? 0),
            rate: Number(createdDetail.rate ?? 0),
            amount: Number(createdDetail.amount ?? 0),
            saDetailBatches: d.saDetailBatches || [],
          });
        }

        // Persist batch rows + update SiteItemBatch closingQty/value
        for (const d of createdDetails) {
          const batches = (d.saDetailBatches || [])
            .map((b: any) => ({
              batchNumber: String(b?.batchNumber || "").trim(),
              batchExpiryDate: String(b?.batchExpiryDate || "").trim(),
              batchIssuedQty: Number(b?.batchIssuedQty ?? 0),
              batchReceivedQty: Number(b?.batchReceivedQty ?? 0),
              batchUnitRate: Number(b?.batchUnitRate ?? 0),
            }))
            .filter(
              (b: any) =>
                !!b.batchNumber &&
                (Number(b.batchIssuedQty) > 0 || Number(b.batchReceivedQty) > 0)
            );

          if (batches.length === 0) continue;

          // Load existing batches for item
          const existingBatches = await tx.siteItemBatch.findMany({
            where: {
              siteId: Number(siteId),
              itemId: Number(d.itemId),
              batchNumber: { in: batches.map((b: any) => String(b.batchNumber)) },
            },
            select: {
              id: true,
              siteItemId: true,
              batchNumber: true,
              expiryDate: true,
              closingQty: true,
              unitRate: true,
              closingValue: true,
            },
          });
          const existingByNo = new Map<string, any>();
          existingBatches.forEach((b: any) => existingByNo.set(String(b.batchNumber), b));

          // Need siteItemId for creating new batches on receive
          const siteItem = await tx.siteItem.findFirst({
            where: { siteId: Number(siteId), itemId: Number(d.itemId) },
            select: { id: true },
          });

          for (const b of batches) {
            const bn = String(b.batchNumber);
            const issuedQty = Number(Number(b.batchIssuedQty || 0).toFixed(4));
            const receivedQty = Number(Number(b.batchReceivedQty || 0).toFixed(4));

            const existing = existingByNo.get(bn);
            const inputRate = Number(b.batchUnitRate ?? 0);
            const unitRate = Number(
              (inputRate > 0 ? inputRate : Number(existing?.unitRate ?? d.rate ?? 0)) || 0
            );
            const amount = Number(
              (((receivedQty > 0 ? receivedQty : issuedQty) * unitRate) || 0).toFixed(2)
            );

            const expiryDate = existing
              ? String(existing.expiryDate || "")
              : String(b.batchExpiryDate || "");

            await tx.stockAdjustmentDetailBatch.create({
              data: {
                stockAdjustmentDetailId: d.id,
                batchNumber: bn,
                expiryDate,
                batchIssuedQty: issuedQty,
                batchReceivedQty: receivedQty,
                unitRate: Number(unitRate.toFixed(2)),
                amount,
              },
            });

            if (existing) {
              const prevQty = Number(existing.closingQty ?? 0);
              const nextQty = Math.max(
                0,
                Number((prevQty - issuedQty + receivedQty).toFixed(4))
              );
              const nextValue = Number((nextQty * unitRate).toFixed(2));
              await tx.siteItemBatch.update({
                where: { id: existing.id },
                data: {
                  closingQty: nextQty,
                  closingValue: nextValue,
                },
              });
            } else if (receivedQty > 0 && siteItem?.id) {
              const nextQty = receivedQty;
              const nextValue = Number((nextQty * unitRate).toFixed(2));
              await tx.siteItemBatch.create({
                data: {
                  siteItemId: siteItem.id,
                  siteId: Number(siteId),
                  itemId: Number(d.itemId),
                  batchNumber: bn,
                  expiryDate: String(b.batchExpiryDate || ""),
                  openingQty: 0,
                  openingValue: 0,
                  batchOpeningRate: 0,
                  unitRate: Number(unitRate.toFixed(2)),
                  closingQty: nextQty,
                  closingValue: nextValue,
                } as any,
              });
            }
          }
        }

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
