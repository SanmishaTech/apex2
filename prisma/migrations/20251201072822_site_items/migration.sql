-- CreateTable
CREATE TABLE `site_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `openingStock` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `openingRate` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `openingValue` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `closingStock` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `closingValue` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `unitRate` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `reorderLevel` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `log` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_items_siteId_idx`(`siteId`),
    INDEX `site_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_items` ADD CONSTRAINT `site_items_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_items` ADD CONSTRAINT `site_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
