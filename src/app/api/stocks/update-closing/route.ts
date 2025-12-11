import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";

// POST /api/stocks/update-closing
// Placeholder implementation: copies opening fields to closing fields for all SiteItem rows
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    // Conditional update based on whether any stock_ledgers exist for the site's siteId
    // If no ledger for the site: closing = opening; unitRate = openingRate
    // Else: closing += opening; value += openingValue; unitRate = updatedClosingValue / updatedClosingStock (safe divide)
    const affected: number = await prisma.$executeRaw`
      UPDATE site_items si
      LEFT JOIN (
        SELECT 
          sl.siteId,
          sl.itemId,
          COALESCE(SUM(sl.receivedQty), 0) AS totalReceivedQty,
          COALESCE(SUM(sl.issuedQty), 0) AS totalIssuedQty,
          COALESCE(SUM(sl.receivedQty * sl.unitRate), 0) AS totalReceivedValue,
          COALESCE(SUM(sl.issuedQty * sl.unitRate), 0) AS totalIssuedValue
        FROM stock_ledgers sl
        GROUP BY sl.siteId, sl.itemId
      ) agg ON agg.siteId = si.siteId AND agg.itemId = si.itemId
      SET 
        si.closingStock = CASE 
          WHEN agg.siteId IS NULL THEN si.openingStock 
          ELSE (COALESCE(agg.totalReceivedQty,0) - COALESCE(agg.totalIssuedQty,0)) + si.openingStock
        END,
        si.closingValue = CASE 
          WHEN agg.siteId IS NULL THEN si.openingValue 
          ELSE (COALESCE(agg.totalReceivedValue,0) - COALESCE(agg.totalIssuedValue,0)) + si.openingValue 
        END,
        si.unitRate = CASE 
          WHEN agg.siteId IS NULL THEN si.openingRate 
          ELSE CASE 
            WHEN ((COALESCE(agg.totalReceivedQty,0) - COALESCE(agg.totalIssuedQty,0)) + si.openingStock) = 0 THEN 0 
            ELSE ((COALESCE(agg.totalReceivedValue,0) - COALESCE(agg.totalIssuedValue,0)) + si.openingValue) / NULLIF(((COALESCE(agg.totalReceivedQty,0) - COALESCE(agg.totalIssuedQty,0)) + si.openingStock), 0)
          END 
        END,
        si.log = 'CLOSING_STOCK_UPDATE',
        si.updatedAt = NOW()
    `;

    return Success({
      updated: affected,
      message: `Closing stock updated for ${affected} items`,
    });
  } catch (error) {
    console.error("Update closing stock error:", error);
    return ApiError("Failed to update closing stock");
  }
}
