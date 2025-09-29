/*
  Warnings:

  - Added the required column `updatedAt` to the `asset_transfer_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `asset_transfer_items_assetTransferId_assetId_key` ON `asset_transfer_items`;

-- AlterTable
ALTER TABLE `asset_transfer_items` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `manpower` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `currentSiteId` INTEGER NULL,
    ADD COLUMN `esic` DECIMAL(10, 2) NULL,
    ADD COLUMN `hours` DECIMAL(5, 2) NULL,
    ADD COLUMN `isAssigned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `minWage` DECIMAL(10, 2) NULL,
    ADD COLUMN `pf` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pt` DECIMAL(10, 2) NULL,
    ADD COLUMN `skillSet` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `manpower_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `manpowerId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `manpower_assignments_siteId_manpowerId_key`(`siteId`, `manpowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `manpower_isAssigned_idx` ON `manpower`(`isAssigned`);

-- CreateIndex
CREATE INDEX `manpower_currentSiteId_idx` ON `manpower`(`currentSiteId`);

-- AddForeignKey
ALTER TABLE `manpower` ADD CONSTRAINT `manpower_currentSiteId_fkey` FOREIGN KEY (`currentSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_assignments` ADD CONSTRAINT `manpower_assignments_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_assignments` ADD CONSTRAINT `manpower_assignments_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
