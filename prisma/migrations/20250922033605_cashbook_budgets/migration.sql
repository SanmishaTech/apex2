-- CreateTable
CREATE TABLE `cashbook_budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `totalBudget` DECIMAL(15, 2) NOT NULL,
    `siteId` INTEGER NULL,
    `companyId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_budgets_name_idx`(`name`),
    INDEX `cashbook_budgets_siteId_idx`(`siteId`),
    INDEX `cashbook_budgets_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_budget_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `budgetId` INTEGER NOT NULL,
    `cashbookHeadId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_budget_items_budgetId_idx`(`budgetId`),
    INDEX `cashbook_budget_items_cashbookHeadId_idx`(`cashbookHeadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budget_items` ADD CONSTRAINT `cashbook_budget_items_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `cashbook_budgets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budget_items` ADD CONSTRAINT `cashbook_budget_items_cashbookHeadId_fkey` FOREIGN KEY (`cashbookHeadId`) REFERENCES `cashbook_heads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
