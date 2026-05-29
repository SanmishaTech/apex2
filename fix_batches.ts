import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Finding corrupted batches and patching them to their True Math...");

  const mismatches = await prisma.$queryRaw`
    SELECT 
        si.id AS siteItemId,
        si.siteId,
        si.itemId
    FROM site_items si
    LEFT JOIN site_item_batches sib ON sib.siteItemId = si.id
    GROUP BY si.id, si.siteId, si.itemId, si.closingStock
  `;

  for (const mismatch of mismatches as any[]) {
    const siteItemId = mismatch.siteItemId;
    const siteId = mismatch.siteId;
    const itemId = mismatch.itemId;

    const batches = await prisma.siteItemBatch.findMany({
      where: { siteItemId },
      select: { id: true, batchNumber: true, openingQty: true, openingValue: true, closingQty: true, closingValue: true }
    });

    const consumptions = await prisma.dailyConsumptionDetailBatch.findMany({
      where: { dailyConsumptionDetail: { itemId, dailyConsumption: { siteId } } },
      select: { batchNumber: true, qty: true, amount: true }
    });

    const outwardIssued = await prisma.outwardDeliveryChallanDetailBatch.findMany({
      where: { outwardDeliveryChallanDetail: { itemId, outwardDeliveryChallan: { fromSiteId: siteId } } },
      select: { batchNumber: true, qty: true, amount: true }
    });

    const outwardReceived = await prisma.outwardDeliveryChallanDetailBatch.findMany({
      where: { outwardDeliveryChallanDetail: { itemId, outwardDeliveryChallan: { toSiteId: siteId } } },
      select: { batchNumber: true, qty: true, amount: true }
    });

    const inwardReceived = await prisma.inwardDeliveryChallanDetailBatch.findMany({
      where: { inwardDeliveryChallanDetail: { poDetails: { itemId }, inwardDeliveryChallan: { siteId } } },
      select: { batchNumber: true, qty: true, amount: true }
    });

    const saIssued = await prisma.stockAdjustmentDetailBatch.findMany({
      where: { stockAdjustmentDetail: { itemId, stockAdjustment: { siteId } } },
      select: { batchNumber: true, batchIssuedQty: true, amount: true }
    });

    const saReceived = await prisma.stockAdjustmentDetailBatch.findMany({
      where: { stockAdjustmentDetail: { itemId, stockAdjustment: { siteId } } },
      select: { batchNumber: true, batchReceivedQty: true, amount: true }
    });

    const sums: Record<string, { qty: number, value: number }> = {};
    for (const b of batches) {
      sums[b.batchNumber] = { 
        qty: Number(b.openingQty || 0), 
        value: Number((b as any).openingValue || 0) 
      };
    }

    for (const c of consumptions) {
      sums[c.batchNumber] = sums[c.batchNumber] || { qty: 0, value: 0 };
      sums[c.batchNumber].qty -= Number(c.qty || 0);
      sums[c.batchNumber].value -= Number(c.amount || 0);
    }
    for (const o of outwardIssued) {
      sums[o.batchNumber] = sums[o.batchNumber] || { qty: 0, value: 0 };
      sums[o.batchNumber].qty -= Number(o.qty || 0);
      sums[o.batchNumber].value -= Number(o.amount || 0);
    }
    for (const r of outwardReceived) {
      sums[r.batchNumber] = sums[r.batchNumber] || { qty: 0, value: 0 };
      sums[r.batchNumber].qty += Number(r.qty || 0);
      sums[r.batchNumber].value += Number(r.amount || 0);
    }
    for (const i of inwardReceived) {
      sums[i.batchNumber] = sums[i.batchNumber] || { qty: 0, value: 0 };
      sums[i.batchNumber].qty += Number(i.qty || 0);
      sums[i.batchNumber].value += Number(i.amount || 0);
    }
    for (const si of saIssued) {
      sums[si.batchNumber] = sums[si.batchNumber] || { qty: 0, value: 0 };
      sums[si.batchNumber].qty -= Number(si.batchIssuedQty || 0);
      sums[si.batchNumber].value -= Number(si.amount || 0);
    }
    for (const sr of saReceived) {
      sums[sr.batchNumber] = sums[sr.batchNumber] || { qty: 0, value: 0 };
      sums[sr.batchNumber].qty += Number(sr.batchReceivedQty || 0);
      sums[sr.batchNumber].value += Number(sr.amount || 0);
    }

    for (const b of batches) {
      const computed = sums[b.batchNumber] || { qty: 0, value: 0 };
      const trueClosing = computed.qty;
      const trueValue = computed.value;
      const actualClosing = Number(b.closingQty || 0);
      const actualValue = Number((b as any).closingValue || 0);

      if (Math.abs(trueClosing - actualClosing) > 0.001 || Math.abs(trueValue - actualValue) > 0.001) {
        const trueUnitRate = trueClosing !== 0 ? trueValue / trueClosing : 0;
        console.log(`Patching Batch '${b.batchNumber}' on SiteItem ${siteItemId}: Qty ${actualClosing}->${trueClosing}, Value ${actualValue}->${trueValue}`);
        await prisma.siteItemBatch.update({
          where: { id: b.id },
          data: { 
            closingQty: trueClosing,
            closingValue: trueValue,
            unitRate: trueUnitRate
          } as any
        });
      }
    }


  }

  console.log("Done patching!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
