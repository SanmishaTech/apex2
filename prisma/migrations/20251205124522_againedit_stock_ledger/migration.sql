-- AlterTable
ALTER TABLE `stock_ledgers` ADD COLUMN `stockAdjustmentId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_stockAdjustmentId_fkey` FOREIGN KEY (`stockAdjustmentId`) REFERENCES `stock_adjustments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
