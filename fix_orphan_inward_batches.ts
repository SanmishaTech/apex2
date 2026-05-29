import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding orphan Inward Delivery Challan Details...");

  const orphans = await prisma.inwardDeliveryChallanDetail.findMany({
    where: {
      poDetails: { item: { isExpiryDate: true } },
      receivingQty: { gt: 0 },
      idcDetailBatches: { none: {} }
    },
    select: { 
      id: true, 
      receivingQty: true, 
      rate: true, 
      amount: true,
      poDetails: { select: { itemId: true } },
      inwardDeliveryChallan: { select: { siteId: true, createdAt: true } }
    }
  });

  if (orphans.length === 0) {
    console.log("No orphan records found.");
    return;
  }

  console.log(`Found ${orphans.length} orphan records. Creating batches...`);

  let counter = 1;
  for (const orphan of orphans) {
    const batchNumber = `Batch${String(counter).padStart(3, '0')}`;
    const expiryDate = "2030-01";
    const createdAt = orphan.inwardDeliveryChallan.createdAt;
    
    console.log(`Creating ${batchNumber} for Inward Detail ID: ${orphan.id} with Qty: ${orphan.receivingQty}`);

    // Ensure SiteItem exists to get siteItemId
    const siteItem = await prisma.siteItem.findFirst({
      where: { 
        siteId: orphan.inwardDeliveryChallan.siteId, 
        itemId: orphan.poDetails.itemId 
      }
    });

    if (siteItem) {
      await prisma.siteItemBatch.upsert({
        where: {
          uq_siteitem_batch_expiry: {
            siteItemId: siteItem.id,
            batchNumber,
            expiryDate
          }
        },
        create: {
          siteItemId: siteItem.id,
          siteId: orphan.inwardDeliveryChallan.siteId,
          itemId: orphan.poDetails.itemId,
          batchNumber,
          expiryDate,
          unitRate: orphan.rate || 0,
          closingQty: orphan.receivingQty,
          closingValue: orphan.amount || 0,
          createdAt: createdAt,
          updatedAt: createdAt
        },
        update: {} // do nothing if already exists
      });
    }

    await prisma.inwardDeliveryChallanDetailBatch.create({
      data: {
        inwardDeliveryChallanDetailId: orphan.id,
        batchNumber: batchNumber,
        expiryDate: expiryDate,
        qty: orphan.receivingQty,
        unitRate: orphan.rate || 0,
        amount: orphan.amount || 0,
        createdAt: createdAt,
        updatedAt: createdAt
      }
    });

    counter++;
  }

  console.log("\nSuccess! All missing batches have been created in the inward batches table.");
  console.log("You can now safely run 'npx tsx fix_batches.ts' followed by 'npx tsx force_sync_siteitems.ts' to synchronize the inventory!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
