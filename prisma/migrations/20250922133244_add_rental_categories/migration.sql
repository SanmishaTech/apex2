-- CreateTable
CREATE TABLE `rental_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rentalCategory` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rental_categories_rentalCategory_key`(`rentalCategory`),
    INDEX `rental_categories_rentalCategory_idx`(`rentalCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `budgetQty` DECIMAL(12, 2) NOT NULL,
    `budgetRate` DECIMAL(12, 2) NOT NULL,
    `purchaseRate` DECIMAL(12, 2) NOT NULL,
    `budgetValue` DECIMAL(12, 2) NOT NULL,
    `orderedQty` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `avgRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `orderedValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `qty50Alert` BOOLEAN NOT NULL DEFAULT false,
    `value50Alert` BOOLEAN NOT NULL DEFAULT false,
    `qty75Alert` BOOLEAN NOT NULL DEFAULT false,
    `value75Alert` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_budgets_siteId_idx`(`siteId`),
    INDEX `site_budgets_itemId_idx`(`itemId`),
    UNIQUE INDEX `site_budgets_siteId_itemId_key`(`siteId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_budgets` ADD CONSTRAINT `site_budgets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_budgets` ADD CONSTRAINT `site_budgets_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
