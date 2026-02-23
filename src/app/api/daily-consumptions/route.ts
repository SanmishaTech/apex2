import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ROLES } from "@/config/roles";

async function generateDailyConsumptionNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const candidates = await tx.dailyConsumption.findMany({
    where: {
      dailyConsumptionNo: {
        contains: "-",
      },
    },
    orderBy: { dailyConsumptionNo: "desc" },
    select: { dailyConsumptionNo: true },
    take: 50,
  });
  const latest = candidates.find((c) =>
    /^(\d{4})-(\d{4})$/.test(c.dailyConsumptionNo)
  );

  let left = 1;
  let right = 1;

  if (latest?.dailyConsumptionNo) {
    const parts = latest.dailyConsumptionNo.split("-");
    if (parts.length === 2) {
      const prevLeft = parseInt(parts[0], 10);
      const prevRight = parseInt(parts[1], 10);
      if (Number.isFinite(prevLeft) && Number.isFinite(prevRight)) {
        left = prevLeft;
        right = prevRight + 1;
        if (right > 9999) {
          left = left + 1;
          right = 1;
        }
      }
    }
  }

  const leftStr = String(left).padStart(4, "0");
  const rightStr = String(right).padStart(4, "0");
  return `${leftStr}-${rightStr}`;
}

const createSchema = z.object({
  dailyConsumptionNo: z.string().max(50).optional(),
  dailyConsumptionDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid daily consumption date",
  }),
  siteId: z.number().int().positive("Site is required"),
  dailyConsumptionDetails: z
    .array(
      z.object({
        itemId: z.number().int().positive("Item ID is required"),
        qty: z.number().nonnegative().default(0),
        rate: z.number().nonnegative().default(0),
        dcDetailBatches: z
          .array(
            z.object({
              batchNumber: z.string().optional().default(""),
              qty: z.number().nonnegative().default(0),
            })
          )
          .optional()
          .default([]),
      })
    )
    .min(1, "At least one item is required"),
});

// GET /api/daily-consumptions?search=&siteId=1&page=1&perPage=10&sort=dailyConsumptionNo&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant");
  if (variant === "dropdown") {
    const perPage = Math.min(
      1000,
      Math.max(1, Number(searchParams.get("perPage")) || 1000)
    );
    const search = searchParams.get("search")?.trim() ?? "";

    const where = search
      ? {
          OR: [{ dailyConsumptionNo: { contains: search } }],
        }
      : undefined;

    const list = await prisma.dailyConsumption.findMany({
      where,
      select: { id: true, dailyConsumptionNo: true },
      orderBy: { dailyConsumptionNo: "asc" },
      take: perPage,
    });
    return Success({ data: list });
  }

  try {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const sort = (searchParams.get("sort") || "dailyConsumptionNo") as string;
    const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as
      | "asc"
      | "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { dailyConsumptionNo: { contains: search } },
        { site: { site: { contains: search } } },
      ];
    }
    const siteIdParam = searchParams.get("siteId");
    if (siteIdParam && !isNaN(Number(siteIdParam))) {
      where.siteId = Number(siteIdParam);
    }

    const sortableFields = new Set([
      "dailyConsumptionNo",
      "dailyConsumptionDate",
      "createdAt",
    ]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { dailyConsumptionNo: "asc" };

    // Site-based visibility: only ADMIN can see all; others limited to assigned sites
    if ((auth as any).user?.role !== ROLES.ADMIN) {
      const employee = await prisma.employee.findFirst({
        where: { userId: (auth as any).user?.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      const assignedSiteIds: number[] = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");
      (where as any).siteId = {
        in: assignedSiteIds.length > 0 ? assignedSiteIds : [-1],
      };
    }

    const result = await paginate({
      model: prisma.dailyConsumption as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        dailyConsumptionNo: true,
        dailyConsumptionDate: true,
        siteId: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, site: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        dailyConsumptionDetails: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            rate: true,
            amount: true,
            item: {
              select: {
                id: true,
                item: true,
                itemCode: true,
                unit: { select: { unitName: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get daily consumptions error:", error);
    return ApiError("Failed to fetch daily consumptions");
  }
}

// POST /api/daily-consumptions - Create new daily consumption
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const validated = createSchema.parse(body);

    const { dailyConsumptionDetails, ...restForValidation } = validated as any;
    // Build details for validation
    const detailsForValidation = (dailyConsumptionDetails || []).map((d: any) => ({
      itemId: Number(d.itemId),
      qty: Number(d.qty ?? 0),
      dcDetailBatches: Array.isArray(d?.dcDetailBatches) ? d.dcDetailBatches : [],
    }));
    const siteIdForValidation = Number((restForValidation as any).siteId);
    if (
      detailsForValidation.length > 0 &&
      Number.isFinite(siteIdForValidation)
    ) {
      const itemIds: number[] = Array.from(
        new Set(detailsForValidation.map((d) => d.itemId))
      );
      // Sum requested qty per item to be robust
      const requestedByItem = new Map<number, number>();
      for (const d of detailsForValidation) {
        const prev = requestedByItem.get(d.itemId) || 0;
        requestedByItem.set(d.itemId, Number((prev + (d.qty || 0)).toFixed(4)));
      }

      // Compute closing from SiteItem.closingStock to match frontend display
      const siteItemsForValidation = await prisma.siteItem.findMany({
        where: { siteId: siteIdForValidation, itemId: { in: itemIds } },
        select: { itemId: true, closingStock: true },
      });
      const closingById = new Map<number, number>();
      for (const si of siteItemsForValidation) {
        closingById.set(Number(si.itemId), Number(si.closingStock ?? 0));
      }

      const errors: string[] = [];
      // Validate each requested item against closing
      let idx = 0;
      for (const d of detailsForValidation) {
        const closing = closingById.get(Number(d.itemId)) ?? 0;
        if (!(d.qty > 0)) {
          errors.push(`Row ${idx + 1}: Qty must be greater than 0`);
        } else {
          const reqTotal = requestedByItem.get(Number(d.itemId)) ?? d.qty;
          if (reqTotal > closing) {
            errors.push(
              `Item ${d.itemId}: Qty cannot exceed closing (${closing})`
            );
          }
        }
        idx++;
      }

      // Validate batch-wise requests (if provided)
      const batchesForValidation = detailsForValidation
        .filter((d: any) => Array.isArray(d.dcDetailBatches) && d.dcDetailBatches.length > 0)
        .flatMap((d: any) =>
          (d.dcDetailBatches || []).map((b: any) => ({
            itemId: Number(d.itemId),
            batchNumber: String(b?.batchNumber || "").trim(),
            qty: Number(b?.qty ?? 0),
          }))
        )
        .filter((b: any) => !!b.batchNumber && b.qty > 0);

      if (batchesForValidation.length > 0) {
        const batchKeys = batchesForValidation.map(
          (b: any) => `${Number(b.itemId)}::${String(b.batchNumber)}`
        );
        const distinctKeys = Array.from(new Set(batchKeys));

        const siteItemBatches = await prisma.siteItemBatch.findMany({
          where: {
            siteId: siteIdForValidation,
            OR: distinctKeys.map((k) => {
              const [itemIdStr, batchNumber] = String(k).split("::");
              return { itemId: Number(itemIdStr), batchNumber: String(batchNumber) };
            }),
          },
          select: {
            id: true,
            itemId: true,
            batchNumber: true,
            closingQty: true,
          },
        });

        const closingByItemBatch = new Map<string, number>();
        for (const b of siteItemBatches) {
          const key = `${Number(b.itemId)}::${String(b.batchNumber)}`;
          closingByItemBatch.set(key, Number(b.closingQty ?? 0));
        }

        const requestedByItemBatch = new Map<string, number>();
        for (const b of batchesForValidation) {
          const key = `${Number(b.itemId)}::${String(b.batchNumber)}`;
          const prev = requestedByItemBatch.get(key) || 0;
          requestedByItemBatch.set(key, Number((prev + Number(b.qty || 0)).toFixed(4)));
        }

        for (const [key, req] of requestedByItemBatch.entries()) {
          const closing = closingByItemBatch.get(key);
          if (closing == null) {
            errors.push(`Batch not found: ${key.replace("::", " / ")}`);
            continue;
          }
          if (req > Number(closing)) {
            errors.push(
              `Batch ${key.replace("::", " / ")}: Qty cannot exceed batch closing (${Number(closing)})`
            );
          }
        }
      }

      if (errors.length > 0) {
        return BadRequest({
          message: "Validation failed",
          details: errors,
        } as any);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const { dailyConsumptionDetails, ...rest } = validated as any;

      const {
        dailyConsumptionNo: rawNo,
        dailyConsumptionDate,
        siteId,
      } = rest as any;

      const finalNo =
        typeof rawNo === "string" && rawNo.trim().length > 0
          ? rawNo.trim()
          : await generateDailyConsumptionNumber(tx);

      // Normalize date to Date object
      const dateVal = (() => {
        if (dailyConsumptionDate instanceof Date) return dailyConsumptionDate;
        if (typeof dailyConsumptionDate === "string") {
          const base = new Date(dailyConsumptionDate);
          if (!isNaN(base.getTime())) {
            const now = new Date();
            base.setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
              now.getMilliseconds()
            );
            return base;
          }
        }
        return new Date();
      })();

      // Compute detail rows using SiteItem.unitRate and roundings
      const distinctItemIds: number[] = Array.from(
        new Set(
          (dailyConsumptionDetails || []).map((d: any) => Number(d.itemId))
        )
      );

      const itemsMeta = distinctItemIds.length
        ? await tx.item.findMany({
            where: { id: { in: distinctItemIds } },
            select: { id: true, isExpiryDate: true },
          })
        : [];
      const isExpiryByItemId = new Map<number, boolean>();
      for (const it of itemsMeta) {
        isExpiryByItemId.set(Number(it.id), Boolean((it as any).isExpiryDate));
      }

      const siteItems = distinctItemIds.length
        ? await tx.siteItem.findMany({
            where: { siteId: Number(siteId), itemId: { in: distinctItemIds } },
            select: {
              id: true,
              itemId: true,
              closingStock: true,
              unitRate: true,
              closingValue: true,
            },
          })
        : [];
      const siteItemById = new Map<
        number,
        {
          id: number;
          itemId: number;
          closingStock: any;
          unitRate: any;
          closingValue: any;
        }
      >();
      siteItems.forEach((si) => siteItemById.set(Number(si.itemId), si));

      // Preload batch unit rates for expiry items so we can compute weighted average rate/amount
      const batchReq = (dailyConsumptionDetails || [])
        .flatMap((d: any) => {
          const itemId = Number(d.itemId);
          const isExpiry = Boolean(isExpiryByItemId.get(itemId));
          const dcBatches = Array.isArray(d?.dcDetailBatches) ? d.dcDetailBatches : [];
          if (!isExpiry || dcBatches.length === 0) return [];
          return dcBatches
            .map((b: any) => ({
              itemId,
              batchNumber: String(b?.batchNumber || "").trim(),
            }))
            .filter((b: any) => !!b.batchNumber);
        })
        .filter(Boolean);

      const distinctBatchKeys = Array.from(
        new Set(batchReq.map((b: any) => `${Number(b.itemId)}::${String(b.batchNumber)}`))
      );
      const batchMeta = distinctBatchKeys.length
        ? await tx.siteItemBatch.findMany({
            where: {
              siteId: Number(siteId),
              OR: distinctBatchKeys.map((k) => {
                const [itemIdStr, batchNumber] = String(k).split("::");
                return { itemId: Number(itemIdStr), batchNumber: String(batchNumber) };
              }),
            },
            select: { itemId: true, batchNumber: true, unitRate: true },
          })
        : [];
      const batchUnitRateByKey = new Map<string, number>();
      for (const b of batchMeta) {
        batchUnitRateByKey.set(
          `${Number((b as any).itemId)}::${String((b as any).batchNumber)}`,
          Number((b as any).unitRate ?? 0)
        );
      }

      const details = (dailyConsumptionDetails || []).map((d: any) => {
        const itemId = Number(d.itemId);
        const isExpiry = Boolean(isExpiryByItemId.get(itemId));
        const dcBatches = Array.isArray(d?.dcDetailBatches) ? d.dcDetailBatches : [];
        const hasBatches = isExpiry && dcBatches.length > 0;

        if (hasBatches) {
          const agg = dcBatches.reduce(
            (acc: { qty: number; amount: number }, r: any) => {
              const bn = String(r?.batchNumber || "").trim();
              const q = Number(Number(r?.qty ?? 0).toFixed(4));
              if (!bn || !(q > 0)) return acc;
              const unitRate = Number(
                Number(batchUnitRateByKey.get(`${itemId}::${bn}`) ?? 0).toFixed(2)
              );
              const amt = Number((q * unitRate).toFixed(2));
              return {
                qty: Number((acc.qty + q).toFixed(4)),
                amount: Number((acc.amount + amt).toFixed(2)),
              };
            },
            { qty: 0, amount: 0 }
          );
          const rate = agg.qty > 0 ? Number((agg.amount / agg.qty).toFixed(2)) : 0;
          return {
            itemId,
            qty: agg.qty,
            rate,
            amount: agg.amount,
            dcDetailBatches: dcBatches,
          };
        }

        const qtyRaw = Number(d.qty ?? 0);
        const qty = Number(qtyRaw.toFixed(4));
        const si = siteItemById.get(itemId);
        const rateNum = Number(si?.unitRate ?? 0);
        const rate = Number(rateNum.toFixed(2));
        const amount = Number((qty * rate).toFixed(2));
        return {
          itemId,
          qty,
          rate,
          amount,
          dcDetailBatches: Array.isArray(d?.dcDetailBatches) ? d.dcDetailBatches : [],
        };
      });

      // (Validation already done above, skip here.)
      const totalAmount = details.reduce(
        (sum, d) => sum + (Number.isFinite(d.amount) ? d.amount : 0),
        0
      );

      const userId = (auth as any).user?.id as number;

      const createdMain = await tx.dailyConsumption.create({
        data: {
          dailyConsumptionNo: finalNo,
          dailyConsumptionDate: dateVal,
          site: { connect: { id: Number(siteId) } },
          totalAmount,
          createdBy: { connect: { id: userId } },
          updatedBy: { connect: { id: userId } },
        },
        select: {
          id: true,
          dailyConsumptionNo: true,
          dailyConsumptionDate: true,
          siteId: true,
          totalAmount: true,
          createdAt: true,
          site: { select: { id: true, site: true } },
        },
      });

      if (details.length > 0) {
        const createdDetails: Array<{
          id: number;
          itemId: number;
          qty: number;
          rate: number;
          amount: number;
          dcDetailBatches: any[];
        }> = [];

        for (const d of details) {
          const createdDetail = await tx.dailyConsumptionDetail.create({
            data: {
              dailyConsumptionId: createdMain.id,
              itemId: d.itemId,
              qty: d.qty,
              rate: d.rate,
              amount: d.amount,
            },
            select: { id: true, itemId: true, qty: true, rate: true, amount: true },
          });
          createdDetails.push({
            id: createdDetail.id,
            itemId: Number(createdDetail.itemId),
            qty: Number(createdDetail.qty ?? 0),
            rate: Number(createdDetail.rate ?? 0),
            amount: Number(createdDetail.amount ?? 0),
            dcDetailBatches: d.dcDetailBatches || [],
          });
        }

        // Persist batch rows + decrement SiteItemBatch for expiry items
        for (const d of createdDetails) {
          const batches = (d.dcDetailBatches || [])
            .map((b: any) => ({
              batchNumber: String(b?.batchNumber || "").trim(),
              qty: Number(b?.qty ?? 0),
            }))
            .filter((b: any) => !!b.batchNumber && Number(b.qty) > 0);

          if (batches.length === 0) continue;

          const siteItemBatches = await tx.siteItemBatch.findMany({
            where: {
              siteId: Number(siteId),
              itemId: Number(d.itemId),
              batchNumber: { in: batches.map((b: any) => String(b.batchNumber)) },
            },
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              closingQty: true,
              unitRate: true,
              closingValue: true,
            },
          });

          const byBatch = new Map<string, any>();
          siteItemBatches.forEach((b: any) => byBatch.set(String(b.batchNumber), b));

          for (const b of batches) {
            const existingBatch = byBatch.get(String(b.batchNumber));
            if (!existingBatch) continue;
            const unitRate = Number(existingBatch.unitRate ?? 0);
            const qty = Number(Number(b.qty || 0).toFixed(4));
            const amount = Number((qty * unitRate).toFixed(2));

            await tx.dailyConsumptionDetailBatch.create({
              data: {
                dailyConsumptionDetailId: d.id,
                batchNumber: String(b.batchNumber),
                expiryDate: String(existingBatch.expiryDate || ""),
                qty,
                unitRate: Number(unitRate.toFixed(2)),
                amount,
              },
            });

            const prevQty = Number(existingBatch.closingQty ?? 0);
            const nextQty = Math.max(0, Number((prevQty - qty).toFixed(4)));
            const nextValue = Number((nextQty * unitRate).toFixed(2));
            await tx.siteItemBatch.update({
              where: { id: existingBatch.id },
              data: {
                closingQty: nextQty,
                closingValue: nextValue,
              },
            });
          }
        }

        // Stock updates: create issue ledger rows and update SiteItem closing stock/value
        for (const d of details) {
          const itemId = Number(d.itemId);
          const isExpiry = Boolean(isExpiryByItemId.get(itemId));
          const hasBatches =
            isExpiry && Array.isArray((d as any).dcDetailBatches) && (d as any).dcDetailBatches.length > 0;

          // Stock Ledger: issue entry for consumption
          await tx.stockLedger.create({
            data: {
              siteId: Number(siteId),
              transactionDate: dateVal,
              itemId,
              dailyConsumptionId: createdMain.id,
              receivedQty: 0,
              issuedQty: d.qty,
              unitRate: d.rate,
              documentType: "DAILY CONSUMPTION",
            },
          });

          // SiteItem update
          const existing =
            siteItemById.get(itemId) ||
            (await tx.siteItem.findFirst({
              where: { siteId: Number(siteId), itemId },
              select: {
                id: true,
                closingStock: true,
                unitRate: true,
                closingValue: true,
              },
            }));

          if (existing && "id" in existing && existing.id) {
            if (hasBatches) {
              const batchTotals = await tx.siteItemBatch.findMany({
                where: { siteId: Number(siteId), itemId },
                select: { closingQty: true, closingValue: true },
              });
              const closingStock = Number(
                batchTotals
                  .reduce((acc: number, r: any) => acc + Number(r?.closingQty ?? 0), 0)
                  .toFixed(4)
              );
              const closingValue = Number(
                batchTotals
                  .reduce((acc: number, r: any) => acc + Number(r?.closingValue ?? 0), 0)
                  .toFixed(2)
              );
              const unitRate =
                closingStock > 0
                  ? Number((closingValue / closingStock).toFixed(4))
                  : 0;
              await tx.siteItem.update({
                where: { id: (existing as any).id },
                data: {
                  closingStock,
                  closingValue,
                  unitRate,
                  log: "DAILY CONSUMPTION",
                },
              });
              continue;
            }

            const prevStock = Number(existing.closingStock || 0);
            const newStock = Math.max(0, Number((prevStock - d.qty).toFixed(4)));
            const newValue = Number((newStock * d.rate).toFixed(2));
            await tx.siteItem.update({
              where: { id: (existing as any).id },
              data: {
                closingStock: newStock,
                closingValue: newValue,
                unitRate: d.rate,
                log: "DAILY CONSUMPTION",
              },
            });
          } else {
            if (hasBatches) {
              const batchTotals = await tx.siteItemBatch.findMany({
                where: { siteId: Number(siteId), itemId },
                select: { closingQty: true, closingValue: true },
              });
              const closingStock = Number(
                batchTotals
                  .reduce((acc: number, r: any) => acc + Number(r?.closingQty ?? 0), 0)
                  .toFixed(4)
              );
              const closingValue = Number(
                batchTotals
                  .reduce((acc: number, r: any) => acc + Number(r?.closingValue ?? 0), 0)
                  .toFixed(2)
              );
              const unitRate =
                closingStock > 0
                  ? Number((closingValue / closingStock).toFixed(4))
                  : 0;
              await tx.siteItem.create({
                data: {
                  siteId: Number(siteId),
                  itemId,
                  openingStock: 0,
                  openingRate: 0,
                  openingValue: 0,
                  closingStock,
                  closingValue,
                  unitRate,
                  log: "DAILY CONSUMPTION NEW",
                } as any,
              });
            } else {
              // Create a record if none exists; result will have zero stock post-issue
              await tx.siteItem.create({
                data: {
                  siteId: Number(siteId),
                  itemId,
                  openingStock: 0,
                  openingRate: 0,
                  openingValue: 0,
                  closingStock: 0,
                  closingValue: 0,
                  unitRate: d.rate,
                  log: "DAILY CONSUMPTION NEW",
                } as any,
              });
            }
          }
        }
      }

      return createdMain;
    });

    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as any).code === "P2002"
    ) {
      return ApiError("Daily consumption already exists", 409);
    }
    console.error("Create daily consumption error:", error);
    return ApiError("Failed to create daily consumption");
  }
}
