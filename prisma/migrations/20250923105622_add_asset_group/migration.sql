-- CreateTable
CREATE TABLE `asset_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetGroup` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_groups_assetGroup_key`(`assetGroup`),
    INDEX `asset_groups_assetGroup_idx`(`assetGroup`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
