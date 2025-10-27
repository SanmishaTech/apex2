/*
  Warnings:

  - You are about to drop the column `boqName` on the `cashbook_budgets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[month,siteId,boqId]` on the table `cashbook_budgets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `cashbook_budget_items` ADD COLUMN `approved1Amount` DECIMAL(12, 2) NULL,
    ADD COLUMN `approvedAmount` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `cashbook_budgets` DROP COLUMN `boqName`,
    ADD COLUMN `acceptedBy` INTEGER NULL,
    ADD COLUMN `acceptedDatetime` DATETIME(3) NULL,
    ADD COLUMN `approved1BudgetAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `approved1By` INTEGER NULL,
    ADD COLUMN `approved1Datetime` DATETIME(3) NULL,
    ADD COLUMN `approvedBudgetAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `approvedBy` INTEGER NULL,
    ADD COLUMN `approvedDatetime` DATETIME(3) NULL,
    ADD COLUMN `boqId` INTEGER NULL,
    MODIFY `totalBudget` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `cashbook_budgets_boqId_idx` ON `cashbook_budgets`(`boqId`);

-- CreateIndex
CREATE UNIQUE INDEX `cashbook_budgets_month_siteId_boqId_key` ON `cashbook_budgets`(`month`, `siteId`, `boqId`);

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_approved1By_fkey` FOREIGN KEY (`approved1By`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_acceptedBy_fkey` FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
