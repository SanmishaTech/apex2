-- AlterTable
ALTER TABLE `stock_ledgers` ADD COLUMN `outwardDeliveryChallanId` INTEGER NULL,
    MODIFY `inwardDeliveryChallanId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `stock_ledgers_outwardDeliveryChallanId_idx` ON `stock_ledgers`(`outwardDeliveryChallanId`);

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_outwardDeliveryChallanId_fkey` FOREIGN KEY (`outwardDeliveryChallanId`) REFERENCES `outward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
