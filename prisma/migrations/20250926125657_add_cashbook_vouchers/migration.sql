/*
  Warnings:

  - You are about to drop the column `assetGroup` on the `asset_groups` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[assetGroupName]` on the table `asset_groups` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `assetGroupName` to the `asset_groups` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `asset_categories_category_idx` ON `asset_categories`;

-- DropIndex
DROP INDEX `asset_groups_assetGroup_idx` ON `asset_groups`;

-- DropIndex
DROP INDEX `asset_groups_assetGroup_key` ON `asset_groups`;

-- AlterTable
ALTER TABLE `asset_groups` DROP COLUMN `assetGroup`,
    ADD COLUMN `assetGroupName` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `cashbooks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucherNo` VARCHAR(191) NULL,
    `voucherDate` DATETIME(3) NOT NULL,
    `siteId` INTEGER NULL,
    `boqId` INTEGER NULL,
    `attachVoucherCopyUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cashbooks_voucherNo_key`(`voucherNo`),
    INDEX `cashbooks_voucherNo_idx`(`voucherNo`),
    INDEX `cashbooks_siteId_idx`(`siteId`),
    INDEX `cashbooks_boqId_idx`(`boqId`),
    INDEX `cashbooks_voucherDate_idx`(`voucherDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashbookId` INTEGER NOT NULL,
    `cashbookHeadId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `received` DECIMAL(12, 2) NULL,
    `expense` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_details_cashbookId_idx`(`cashbookId`),
    INDEX `cashbook_details_cashbookHeadId_idx`(`cashbookHeadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `asset_groups_assetGroupName_key` ON `asset_groups`(`assetGroupName`);

-- AddForeignKey
ALTER TABLE `cashbooks` ADD CONSTRAINT `cashbooks_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbooks` ADD CONSTRAINT `cashbooks_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_details` ADD CONSTRAINT `cashbook_details_cashbookId_fkey` FOREIGN KEY (`cashbookId`) REFERENCES `cashbooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_details` ADD CONSTRAINT `cashbook_details_cashbookHeadId_fkey` FOREIGN KEY (`cashbookHeadId`) REFERENCES `cashbook_heads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
