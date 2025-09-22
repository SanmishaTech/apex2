/*
  Warnings:

  - You are about to drop the column `budgetAmount` on the `cashbook_budgets` table. All the data in the column will be lost.
  - You are about to drop the column `budgetPeriod` on the `cashbook_budgets` table. All the data in the column will be lost.
  - You are about to drop the column `cashbookHeadId` on the `cashbook_budgets` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `cashbook_budgets` table. All the data in the column will be lost.
  - Added the required column `month` to the `cashbook_budgets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `cashbook_budgets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalBudget` to the `cashbook_budgets` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `cashbook_budgets` DROP FOREIGN KEY `cashbook_budgets_cashbookHeadId_fkey`;

-- DropIndex
DROP INDEX `cashbook_budgets_budgetPeriod_idx` ON `cashbook_budgets`;

-- AlterTable
ALTER TABLE `cashbook_budgets` DROP COLUMN `budgetAmount`,
    DROP COLUMN `budgetPeriod`,
    DROP COLUMN `cashbookHeadId`,
    DROP COLUMN `description`,
    ADD COLUMN `approved1Remarks` TEXT NULL,
    ADD COLUMN `attachCopyUrl` VARCHAR(191) NULL,
    ADD COLUMN `boqName` VARCHAR(191) NULL,
    ADD COLUMN `month` VARCHAR(191) NOT NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `remarksForFinalApproval` TEXT NULL,
    ADD COLUMN `siteId` INTEGER NULL,
    ADD COLUMN `totalBudget` DECIMAL(12, 2) NOT NULL;

-- CreateTable
CREATE TABLE `cashbook_budget_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `budgetId` INTEGER NOT NULL,
    `cashbookHeadId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_budget_items_budgetId_idx`(`budgetId`),
    INDEX `cashbook_budget_items_cashbookHeadId_idx`(`cashbookHeadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cashbook_budgets_name_idx` ON `cashbook_budgets`(`name`);

-- CreateIndex
CREATE INDEX `cashbook_budgets_month_idx` ON `cashbook_budgets`(`month`);

-- CreateIndex
CREATE INDEX `cashbook_budgets_siteId_idx` ON `cashbook_budgets`(`siteId`);

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budget_items` ADD CONSTRAINT `cashbook_budget_items_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `cashbook_budgets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budget_items` ADD CONSTRAINT `cashbook_budget_items_cashbookHeadId_fkey` FOREIGN KEY (`cashbookHeadId`) REFERENCES `cashbook_heads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
