/*
  Warnings:

  - Added the required column `updatedAt` to the `stock_adjustment_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stock_adjustment_details` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `opening_stocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `opening_stocks_siteId_idx`(`siteId`),
    INDEX `opening_stocks_createdById_idx`(`createdById`),
    INDEX `opening_stocks_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opening_stock_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `openingStockId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `openingStock` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    `openingRate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `openingValue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `opening_stock_details_itemId_idx`(`itemId`),
    INDEX `opening_stock_details_openingStockId_idx`(`openingStockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `opening_stocks` ADD CONSTRAINT `opening_stocks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stocks` ADD CONSTRAINT `opening_stocks_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stocks` ADD CONSTRAINT `opening_stocks_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_details` ADD CONSTRAINT `opening_stock_details_openingStockId_fkey` FOREIGN KEY (`openingStockId`) REFERENCES `opening_stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opening_stock_details` ADD CONSTRAINT `opening_stock_details_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
