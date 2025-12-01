/*
  Warnings:

  - You are about to alter the column `openingRate` on the `site_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(12,2)`.
  - You are about to alter the column `openingValue` on the `site_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(12,2)`.
  - You are about to alter the column `closingValue` on the `site_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(12,2)`.
  - You are about to alter the column `unitRate` on the `site_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(12,2)`.
  - A unique constraint covering the columns `[inwardChallanNo]` on the table `inward_delivery_challans` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `inward_delivery_challans` MODIFY `inwardChallanNo` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `site_items` MODIFY `openingRate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `openingValue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `closingValue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `unitRate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE `outward_delivery_challans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `outwardChallanNo` VARCHAR(191) NOT NULL,
    `outwardChallanDate` DATETIME(3) NOT NULL,
    `challanNo` VARCHAR(100) NOT NULL,
    `challanDate` DATETIME(3) NOT NULL,
    `fromSiteId` INTEGER NOT NULL,
    `toSiteId` INTEGER NOT NULL,
    `isApproved1` BOOLEAN NOT NULL DEFAULT false,
    `approved1ById` INTEGER NULL,
    `approved1At` DATETIME(3) NULL,
    `isAccepted` BOOLEAN NOT NULL DEFAULT false,
    `acceptedById` INTEGER NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `revision` INTEGER NULL,

    UNIQUE INDEX `outward_delivery_challans_outwardChallanNo_key`(`outwardChallanNo`),
    INDEX `outward_delivery_challans_fromSiteId_idx`(`fromSiteId`),
    INDEX `outward_delivery_challans_toSiteId_idx`(`toSiteId`),
    INDEX `outward_delivery_challans_approved1ById_idx`(`approved1ById`),
    INDEX `outward_delivery_challans_acceptedById_idx`(`acceptedById`),
    INDEX `outward_delivery_challans_createdById_idx`(`createdById`),
    INDEX `outward_delivery_challans_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outward_delivery_challan_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `outwardDeliveryChallanId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `qty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `challanQty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `approved1Qty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `receivedQty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `outward_delivery_challan_details_outwardDeliveryChallanId_idx`(`outwardDeliveryChallanId`),
    INDEX `outward_delivery_challan_details_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outward_delivery_challan_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `outwardDeliveryChallanId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `outward_delivery_challan_documents_outwardDeliveryChallanId_idx`(`outwardDeliveryChallanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `inward_delivery_challans_inwardChallanNo_key` ON `inward_delivery_challans`(`inwardChallanNo`);

-- AddForeignKey
ALTER TABLE `outward_delivery_challans` ADD CONSTRAINT `outward_delivery_challans_approved1ById_fkey` FOREIGN KEY (`approved1ById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challans` ADD CONSTRAINT `outward_delivery_challans_acceptedById_fkey` FOREIGN KEY (`acceptedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challans` ADD CONSTRAINT `outward_delivery_challans_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challans` ADD CONSTRAINT `outward_delivery_challans_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challans` ADD CONSTRAINT `outward_delivery_challans_fromSiteId_fkey` FOREIGN KEY (`fromSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challans` ADD CONSTRAINT `outward_delivery_challans_toSiteId_fkey` FOREIGN KEY (`toSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challan_details` ADD CONSTRAINT `outward_delivery_challan_details_outwardDeliveryChallanId_fkey` FOREIGN KEY (`outwardDeliveryChallanId`) REFERENCES `outward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challan_details` ADD CONSTRAINT `outward_delivery_challan_details_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outward_delivery_challan_documents` ADD CONSTRAINT `outward_delivery_challan_documents_outwardDeliveryChallanId_fkey` FOREIGN KEY (`outwardDeliveryChallanId`) REFERENCES `outward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
