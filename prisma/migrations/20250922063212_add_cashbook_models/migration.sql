-- CreateTable
CREATE TABLE `cashbook_heads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashbookHeadName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cashbook_heads_cashbookHeadName_key`(`cashbookHeadName`),
    INDEX `cashbook_heads_cashbookHeadName_idx`(`cashbookHeadName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashbookHeadId` INTEGER NOT NULL,
    `budgetAmount` DECIMAL(12, 2) NOT NULL,
    `budgetPeriod` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_budgets_cashbookHeadId_idx`(`cashbookHeadId`),
    INDEX `cashbook_budgets_budgetPeriod_idx`(`budgetPeriod`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_cashbookHeadId_fkey` FOREIGN KEY (`cashbookHeadId`) REFERENCES `cashbook_heads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
