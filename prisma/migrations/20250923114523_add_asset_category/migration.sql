-- CreateTable
CREATE TABLE `asset_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetGroupId` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `asset_categories_assetGroupId_idx`(`assetGroupId`),
    INDEX `asset_categories_category_idx`(`category`),
    UNIQUE INDEX `asset_categories_assetGroupId_category_key`(`assetGroupId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `asset_categories` ADD CONSTRAINT `asset_categories_assetGroupId_fkey` FOREIGN KEY (`assetGroupId`) REFERENCES `asset_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
