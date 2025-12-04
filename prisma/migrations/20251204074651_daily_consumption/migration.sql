/*
  Warnings:

  - You are about to alter the column `paymentMode` on the `inward_bill_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(20)` to `Enum(EnumId(6))`.
  - You are about to drop the column `revision` on the `outward_delivery_challans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `inward_bill_details` MODIFY `paymentMode` ENUM('CASH', 'UPI', 'CHEQUE', 'RTGS', 'NEFT', 'NET_BANKING') NOT NULL;

-- AlterTable
ALTER TABLE `outward_delivery_challans` DROP COLUMN `revision`;

-- CreateTable
CREATE TABLE `daily_consumptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dailyConsumptionNo` VARCHAR(191) NOT NULL,
    `dailyConsumptionDate` DATETIME(3) NOT NULL,
    `siteId` INTEGER NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_consumptions_dailyConsumptionNo_key`(`dailyConsumptionNo`),
    INDEX `daily_consumptions_siteId_idx`(`siteId`),
    INDEX `daily_consumptions_createdById_idx`(`createdById`),
    INDEX `daily_consumptions_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_consumption_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dailyConsumptionId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `qty` DECIMAL(12, 4) NULL,
    `rate` DECIMAL(12, 2) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `daily_consumption_details_dailyConsumptionId_idx`(`dailyConsumptionId`),
    INDEX `daily_consumption_details_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_consumptions` ADD CONSTRAINT `daily_consumptions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_consumptions` ADD CONSTRAINT `daily_consumptions_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_consumptions` ADD CONSTRAINT `daily_consumptions_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_consumption_details` ADD CONSTRAINT `daily_consumption_details_dailyConsumptionId_fkey` FOREIGN KEY (`dailyConsumptionId`) REFERENCES `daily_consumptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_consumption_details` ADD CONSTRAINT `daily_consumption_details_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
