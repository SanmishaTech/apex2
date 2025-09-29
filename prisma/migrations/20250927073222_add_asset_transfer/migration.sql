-- AlterTable
ALTER TABLE `assets` ADD COLUMN `currentSiteId` INTEGER NULL,
    ADD COLUMN `transferStatus` VARCHAR(191) NOT NULL DEFAULT 'Available';

-- CreateTable
CREATE TABLE `asset_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challanNo` VARCHAR(191) NOT NULL,
    `challanDate` DATETIME(3) NOT NULL,
    `transferType` VARCHAR(191) NOT NULL,
    `fromSiteId` INTEGER NULL,
    `toSiteId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `challanCopyUrl` VARCHAR(191) NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_transfers_challanNo_key`(`challanNo`),
    INDEX `asset_transfers_challanNo_idx`(`challanNo`),
    INDEX `asset_transfers_fromSiteId_idx`(`fromSiteId`),
    INDEX `asset_transfers_toSiteId_idx`(`toSiteId`),
    INDEX `asset_transfers_status_idx`(`status`),
    INDEX `asset_transfers_transferType_idx`(`transferType`),
    INDEX `asset_transfers_challanDate_idx`(`challanDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetTransferId` INTEGER NOT NULL,
    `assetId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_transfer_items_assetTransferId_idx`(`assetTransferId`),
    INDEX `asset_transfer_items_assetId_idx`(`assetId`),
    UNIQUE INDEX `asset_transfer_items_assetTransferId_assetId_key`(`assetTransferId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `assets_transferStatus_idx` ON `assets`(`transferStatus`);

-- CreateIndex
CREATE INDEX `assets_currentSiteId_idx` ON `assets`(`currentSiteId`);

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_currentSiteId_fkey` FOREIGN KEY (`currentSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `asset_transfers_fromSiteId_fkey` FOREIGN KEY (`fromSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `asset_transfers_toSiteId_fkey` FOREIGN KEY (`toSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `asset_transfers_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfer_items` ADD CONSTRAINT `asset_transfer_items_assetTransferId_fkey` FOREIGN KEY (`assetTransferId`) REFERENCES `asset_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfer_items` ADD CONSTRAINT `asset_transfer_items_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
