import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const batchSchema = z.object({
  batchNumber: z.string().min(1, "Batch number is required"),
  expiryDate: z
    .string()
    .min(1, "Expiry date is required")
    .regex(/^\d{4}-\d{2}$/, "Expiry date must be in YYYY-MM format"),
  openingQty: z.coerce
    .number()
    .min(0, "Opening qty must be >= 0")
    .max(9999999999.99, "Opening qty too large"),
  batchOpeningRate: z.coerce
    .number()
    .min(0, "Batch opening rate must be >= 0")
    .max(9999999999.99, "Batch opening rate too large"),
  openingValue: z.coerce
    .number()
    .min(0, "Opening value must be >= 0")
    .max(9999999999.99, "Opening value too large"),
});

const openingStockDetailSchema = z
  .object({
    // Support both itemId and item as incoming keys; coerce to number
    itemId: z.coerce.number().optional(),
    item: z.coerce.number().optional(),
    openingStock: z.coerce
      .number()
      .min(0, "Opening stock must be >= 0")
      .max(9999999999.9999, "Opening stock too large"),
    openingRate: z.coerce
      .number()
      .min(0, "Opening rate must be >= 0")
      .max(9999999999.99, "Opening rate too large"),
    openingValue: z.coerce
      .number()
      .min(0, "Opening value must be >= 0")
      .max(9999999999.99, "Opening value too large"),
    batches: z.array(batchSchema).optional(),
  })
  .transform((val) => ({
    itemId:
      typeof val.itemId === "number" && Number.isFinite(val.itemId)
        ? val.itemId
        : typeof val.item === "number" && Number.isFinite(val.item)
        ? val.item
        : NaN,
    openingStock: val.openingStock,
    openingRate: val.openingRate,
    openingValue: val.openingValue,
    batches: val.batches,
  }));

const createSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required"),
  details: z.array(openingStockDetailSchema).optional(),
});

// POST /api/stocks - Create Opening Stock with details
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    // Validate that all detail itemIds are present after transform (only if details provided)
    if (Array.isArray(parsed.details) && parsed.details.length > 0) {
      const missingItemIndex = parsed.details.findIndex(
        (d) => !Number.isFinite(d.itemId)
      );
      if (missingItemIndex >= 0) {
        return BadRequest([
          {
            code: z.ZodIssueCode.custom,
            path: ["details", missingItemIndex, "itemId"],
            message: "Item is required",
          },
        ]);
      }
    }

    // Validate that itemIds are unique (no duplicate items in opening stock details)
    {
      if (Array.isArray(parsed.details) && parsed.details.length > 0) {
        const seen = new Set<number>();
        for (let i = 0; i < parsed.details.length; i++) {
          const id = parsed.details[i].itemId as number;
          if (seen.has(id)) {
            return ApiError("Duplicate item entries are not allowed", 500);
          }
          seen.add(id);
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update details sequentially to preserve serial order if needed in future
      if (Array.isArray(parsed.details) && parsed.details.length > 0) {
        for (const d of parsed.details) {
          // Upsert SiteItem (update if exists for site+item, else create)
          const existing = await tx.siteItem.findFirst({
            where: { siteId: parsed.siteId, itemId: d.itemId as number },
            select: {
              id: true,
              openingStock: true,
              openingValue: true,
              closingStock: true,
              closingValue: true,
            },
          });

          const siteItemId = existing?.id
            ? (
                await tx.siteItem.update({
                  where: { id: existing.id },
                  data: (() => {
                    const prevOpeningStock = Number(existing.openingStock || 0);
                    const prevOpeningValue = Number(existing.openingValue || 0);
                    const prevClosingStock = Number(existing.closingStock || 0);
                    const prevClosingValue = Number(existing.closingValue || 0);

                    const deltaStock = Number(d.openingStock || 0) - prevOpeningStock;
                    const deltaValue = Number(d.openingValue || 0) - prevOpeningValue;

                    const nextClosingStock = Math.max(0, prevClosingStock + deltaStock);
                    const nextClosingValue = Math.max(0, prevClosingValue + deltaValue);
                    const nextUnitRate =
                      Number.isFinite(nextClosingStock) && nextClosingStock > 0
                        ? nextClosingValue / nextClosingStock
                        : 0;

                    return {
                      openingStock: d.openingStock,
                      openingRate: d.openingRate,
                      openingValue: d.openingValue,
                      closingStock: nextClosingStock,
                      closingValue: nextClosingValue,
                      unitRate: nextUnitRate,
                      log: "OPENING_STOCK",
                    };
                  })(),
                  select: { id: true },
                })
              ).id
            : (
                await tx.siteItem.create({
                  data: (() => {
                    const openingStock = Number(d.openingStock || 0);
                    const openingValue = Number(d.openingValue || 0);
                    const unitRate =
                      Number.isFinite(openingStock) && openingStock > 0
                        ? openingValue / openingStock
                        : 0;
                    return {
                      siteId: parsed.siteId,
                      itemId: d.itemId as number,
                      openingStock: d.openingStock,
                      openingRate: d.openingRate,
                      openingValue: d.openingValue,
                      closingStock: d.openingStock,
                      closingValue: d.openingValue,
                      unitRate,
                      log: "OPENING_STOCK",
                    };
                  })(),
                  select: { id: true },
                })
              ).id;

          // Optional: upsert batches (for expiry-tracked items)
          const submittedBatchNumbers = new Set<string>();
          if (Array.isArray((d as any).batches) && (d as any).batches.length > 0) {
            for (const b of (d as any).batches) {
              const batchNumber = String(b.batchNumber || "").trim();
              if (!batchNumber) continue;
              submittedBatchNumbers.add(batchNumber);

              const existingBatch = await tx.siteItemBatch.findFirst({
                where: { siteItemId, batchNumber },
                select: {
                  id: true,
                  openingQty: true,
                  openingValue: true,
                  closingQty: true,
                  closingValue: true,
                },
              });

              if (!existingBatch) {
                const closingQty = Number(b.openingQty || 0);
                const closingValue = Number(b.openingValue || 0);
                const unitRate =
                  Number.isFinite(closingQty) && closingQty > 0
                    ? closingValue / closingQty
                    : 0;

                await tx.siteItemBatch.create({
                  data: {
                    siteItemId,
                    siteId: parsed.siteId,
                    itemId: d.itemId as number,
                    batchNumber,
                    expiryDate: String(b.expiryDate || ""),
                    openingQty: b.openingQty,
                    batchOpeningRate: b.batchOpeningRate,
                    openingValue: b.openingValue,
                    closingQty: b.openingQty,
                    closingValue: b.openingValue,
                    unitRate,
                  },
                });
              } else {
                const prevOpeningQty = Number(existingBatch.openingQty || 0);
                const prevOpeningValue = Number(existingBatch.openingValue || 0);
                const prevClosingQty = Number(existingBatch.closingQty || 0);
                const prevClosingValue = Number(existingBatch.closingValue || 0);

                const deltaQty = Number(b.openingQty || 0) - prevOpeningQty;
                const deltaVal = Number(b.openingValue || 0) - prevOpeningValue;

                const nextClosingQty = Math.max(0, prevClosingQty + deltaQty);
                const nextClosingValue = Math.max(0, prevClosingValue + deltaVal);
                const nextUnitRate =
                  Number.isFinite(nextClosingQty) && nextClosingQty > 0
                    ? nextClosingValue / nextClosingQty
                    : 0;

                await tx.siteItemBatch.update({
                  where: { id: existingBatch.id },
                  data: {
                    expiryDate: String(b.expiryDate || ""),
                    openingQty: b.openingQty,
                    batchOpeningRate: b.batchOpeningRate,
                    openingValue: b.openingValue,
                    closingQty: nextClosingQty,
                    closingValue: nextClosingValue,
                    unitRate: nextUnitRate,
                  },
                });
              }
            }
          }

          // Handle removed batches: those existing for this siteItem but not submitted
          const existingBatches = await tx.siteItemBatch.findMany({
            where: { siteItemId },
            select: {
              id: true,
              batchNumber: true,
              openingQty: true,
              openingValue: true,
              closingQty: true,
              closingValue: true,
            },
          });

          const batchesToZero = existingBatches.filter(
            (eb) => !submittedBatchNumbers.has(String(eb.batchNumber))
          );

          for (const eb of batchesToZero) {
            const prevOpeningQty = Number(eb.openingQty || 0);
            const prevOpeningValue = Number(eb.openingValue || 0);
            const prevClosingQty = Number(eb.closingQty || 0);
            const prevClosingValue = Number(eb.closingValue || 0);

            const nextClosingQty = Math.max(0, prevClosingQty - prevOpeningQty);
            const nextClosingValue = Math.max(0, prevClosingValue - prevOpeningValue);
            const nextUnitRate =
              Number.isFinite(nextClosingQty) && nextClosingQty > 0
                ? nextClosingValue / nextClosingQty
                : 0;

            await tx.siteItemBatch.update({
              where: { id: eb.id },
              data: {
                openingQty: 0,
                batchOpeningRate: 0,
                openingValue: 0,
                closingQty: nextClosingQty,
                closingValue: nextClosingValue,
                unitRate: nextUnitRate,
              },
            });
          }
        }
      }

      // Zero out opening fields for other existing site_items at this site not included in payload,
      // while adjusting closing fields by subtracting the previous opening (same delta approach).
      {
        const includedItemIds =
          Array.isArray(parsed.details) && parsed.details.length > 0
            ? parsed.details.map((d) => d.itemId as number)
            : [];

        const excludedSiteItems = await tx.siteItem.findMany({
          where: {
            siteId: parsed.siteId,
            ...(includedItemIds.length ? { itemId: { notIn: includedItemIds } } : {}),
          },
          select: {
            id: true,
            openingStock: true,
            openingValue: true,
            closingStock: true,
            closingValue: true,
          },
        });

        for (const si of excludedSiteItems) {
          const prevOpeningStock = Number(si.openingStock || 0);
          const prevOpeningValue = Number(si.openingValue || 0);
          const prevClosingStock = Number(si.closingStock || 0);
          const prevClosingValue = Number(si.closingValue || 0);

          const nextClosingStock = Math.max(0, prevClosingStock - prevOpeningStock);
          const nextClosingValue = Math.max(0, prevClosingValue - prevOpeningValue);
          const nextUnitRate =
            Number.isFinite(nextClosingStock) && nextClosingStock > 0
              ? nextClosingValue / nextClosingStock
              : 0;

          await tx.siteItem.update({
            where: { id: si.id },
            data: {
              openingStock: 0,
              openingRate: 0,
              openingValue: 0,
              closingStock: nextClosingStock,
              closingValue: nextClosingValue,
              unitRate: nextUnitRate,
              log: "OPENING_STOCK_ZEROED",
            },
          });
        }

        const excludedBatches = await tx.siteItemBatch.findMany({
          where: {
            siteId: parsed.siteId,
            ...(includedItemIds.length ? { itemId: { notIn: includedItemIds } } : {}),
          },
          select: {
            id: true,
            openingQty: true,
            openingValue: true,
            closingQty: true,
            closingValue: true,
          },
        });

        for (const b of excludedBatches) {
          const prevOpeningQty = Number(b.openingQty || 0);
          const prevOpeningValue = Number(b.openingValue || 0);
          const prevClosingQty = Number(b.closingQty || 0);
          const prevClosingValue = Number(b.closingValue || 0);

          const nextClosingQty = Math.max(0, prevClosingQty - prevOpeningQty);
          const nextClosingValue = Math.max(0, prevClosingValue - prevOpeningValue);
          const nextUnitRate =
            Number.isFinite(nextClosingQty) && nextClosingQty > 0
              ? nextClosingValue / nextClosingQty
              : 0;

          await tx.siteItemBatch.update({
            where: { id: b.id },
            data: {
              openingQty: 0,
              batchOpeningRate: 0,
              openingValue: 0,
              closingQty: nextClosingQty,
              closingValue: nextClosingValue,
              unitRate: nextUnitRate,
            },
          });
        }
      }

      return { ok: true };
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.issues);
    }

    console.error("Create opening stock error:", error);
    return ApiError("Failed to create opening stock");
  }
}
