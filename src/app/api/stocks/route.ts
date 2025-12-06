import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

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
  }));

const createSchema = z.object({
  siteId: z.coerce.number().min(1, "Site is required"),
  details: z
    .array(openingStockDetailSchema)
    .min(1, "At least one item is required"),
});

// POST /api/stocks - Create Opening Stock with details
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    // Validate that all detail itemIds are present after transform
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

    // Validate that itemIds are unique (no duplicate items in opening stock details)
    {
      const seen = new Set<number>();
      for (let i = 0; i < parsed.details.length; i++) {
        const id = parsed.details[i].itemId as number;
        if (seen.has(id)) {
          return ApiError("Duplicate item entries are not allowed", 500);
        }
        seen.add(id);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const openingStock = await tx.openingStock.create({
        data: {
          siteId: parsed.siteId,
          createdById: auth.user.id,
          updatedById: auth.user.id,
        },
        select: { id: true, siteId: true, createdAt: true, updatedAt: true },
      });

      // Create details sequentially to preserve serial order if needed in future
      for (const d of parsed.details) {
        // Create OpeningStockDetail
        await tx.openingStockDetail.create({
          data: {
            openingStockId: openingStock.id,
            itemId: d.itemId as number,
            openingStock: d.openingStock,
            openingRate: d.openingRate,
            openingValue: d.openingValue,
          },
        });

        // Also upsert SiteItem (update if exists for site+item, else create)
        const existing = await tx.siteItem.findFirst({
          where: { siteId: parsed.siteId, itemId: d.itemId as number },
          select: { id: true },
        });
        if (existing) {
          await tx.siteItem.update({
            where: { id: existing.id },
            data: {
              openingStock: d.openingStock,
              openingRate: d.openingRate,
              openingValue: d.openingValue,
              log: "OPENING_STOCK",
            },
          });
        } else {
          await tx.siteItem.create({
            data: {
              siteId: parsed.siteId,
              itemId: d.itemId as number,
              openingStock: d.openingStock,
              openingRate: d.openingRate,
              openingValue: d.openingValue,
              log: "OPENING_STOCK",
            },
          });
        }
      }

      // Return created record with details
      const created = await tx.openingStock.findUnique({
        where: { id: openingStock.id },
        select: {
          id: true,
          siteId: true,
          createdById: true,
          updatedById: true,
          createdAt: true,
          updatedAt: true,
          openingStockDetails: {
            select: {
              id: true,
              itemId: true,
              openingStock: true,
              openingRate: true,
              openingValue: true,
              createdAt: true,
              updatedAt: true,
              item: { select: { id: true, itemCode: true, item: true } },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      return created;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Create opening stock error:", error);
    return ApiError("Failed to create opening stock");
  }
}
