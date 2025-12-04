-- DropForeignKey
ALTER TABLE `stock_ledgers` DROP FOREIGN KEY `stock_ledgers_inwardDeliveryChallanId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_ledgers` DROP FOREIGN KEY `stock_ledgers_outwardDeliveryChallanId_fkey`;

-- AlterTable
ALTER TABLE `stock_ledgers` ADD COLUMN `dailyConsumptionId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_outwardDeliveryChallanId_fkey` FOREIGN KEY (`outwardDeliveryChallanId`) REFERENCES `outward_delivery_challans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_dailyConsumptionId_fkey` FOREIGN KEY (`dailyConsumptionId`) REFERENCES `daily_consumptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
