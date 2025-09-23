-- CreateTable
CREATE TABLE `assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetNo` VARCHAR(191) NOT NULL,
    `assetGroupId` INTEGER NOT NULL,
    `assetCategoryId` INTEGER NOT NULL,
    `assetName` VARCHAR(191) NOT NULL,
    `make` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `purchaseDate` DATETIME(3) NULL,
    `invoiceNo` VARCHAR(191) NULL,
    `supplier` VARCHAR(191) NULL,
    `invoiceCopyUrl` VARCHAR(191) NULL,
    `nextMaintenanceDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Working',
    `useStatus` VARCHAR(191) NOT NULL DEFAULT 'In Use',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assets_assetNo_key`(`assetNo`),
    INDEX `assets_assetNo_idx`(`assetNo`),
    INDEX `assets_assetGroupId_idx`(`assetGroupId`),
    INDEX `assets_assetCategoryId_idx`(`assetCategoryId`),
    INDEX `assets_assetName_idx`(`assetName`),
    INDEX `assets_status_idx`(`status`),
    INDEX `assets_useStatus_idx`(`useStatus`),
    INDEX `assets_purchaseDate_idx`(`purchaseDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assetGroupId_fkey` FOREIGN KEY (`assetGroupId`) REFERENCES `asset_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assetCategoryId_fkey` FOREIGN KEY (`assetCategoryId`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
