import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Syncing SiteItem opening/closing stock to perfectly match their batches...");

  const mismatches = await prisma.$queryRaw`
    SELECT
        si.id AS siteItemId
    FROM site_items si
    INNER JOIN items i ON i.id = si.itemId
    LEFT JOIN site_item_batches sib ON sib.siteItemId = si.id
    WHERE i.isExpiryDate = true
    GROUP BY si.id, si.closingStock, si.openingStock
  `;

  for (const mismatch of mismatches as any[]) {
    const siteItemId = mismatch.siteItemId;

    const batches = await prisma.siteItemBatch.findMany({
      where: { siteItemId },
      select: { openingQty: true, closingQty: true, openingValue: true, closingValue: true }
    });

    let totalOpening = 0;
    let totalClosing = 0;
    let totalOpeningValue = 0;
    let totalClosingValue = 0;
    for (const b of batches) {
      totalOpening += Number(b.openingQty || 0);
      totalClosing += Number(b.closingQty || 0);
      totalOpeningValue += Number((b as any).openingValue || 0);
      totalClosingValue += Number((b as any).closingValue || 0);
    }

    const trueUnitRate = totalClosing !== 0 ? totalClosingValue / totalClosing : 0;

    const si = await prisma.siteItem.findUnique({
      where: { id: siteItemId },
      select: { openingStock: true, closingStock: true, openingValue: true, closingValue: true, unitRate: true }
    });

    console.log(`Fixing SiteItem ${siteItemId}: Opening ${si?.openingStock}->${totalOpening}, Closing ${si?.closingStock}->${totalClosing}, Value ${si?.closingValue}->${totalClosingValue}, Rate ${si?.unitRate}->${trueUnitRate}`);

    await prisma.siteItem.update({
      where: { id: siteItemId },
      data: {
        openingStock: totalOpening,
        closingStock: totalClosing,
        openingValue: totalOpeningValue,
        closingValue: totalClosingValue,
        unitRate: trueUnitRate
      } as any
    });
  }

  console.log("Done syncing SiteItems!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
