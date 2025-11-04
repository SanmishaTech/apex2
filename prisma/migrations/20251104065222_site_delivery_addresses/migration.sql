/*
  Warnings:

  - You are about to drop the column `contactNo` on the `sites` table. All the data in the column will be lost.
  - You are about to drop the column `contactPerson` on the `sites` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sites` DROP COLUMN `contactNo`,
    DROP COLUMN `contactPerson`;

-- CreateTable
CREATE TABLE `site_delivery_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pinCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_delivery_addresses_siteId_idx`(`siteId`),
    INDEX `site_delivery_addresses_stateId_idx`(`stateId`),
    INDEX `site_delivery_addresses_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_delivery_addresses` ADD CONSTRAINT `site_delivery_addresses_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_delivery_addresses` ADD CONSTRAINT `site_delivery_addresses_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_delivery_addresses` ADD CONSTRAINT `site_delivery_addresses_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
