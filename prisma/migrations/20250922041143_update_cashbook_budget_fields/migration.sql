/*
  Warnings:

  - You are about to drop the column `companyId` on the `cashbook_budgets` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `cashbook_budgets` table. All the data in the column will be lost.
  - Added the required column `month` to the `cashbook_budgets` table without a default value. This is not possible if the table is not empty.
  - Made the column `siteId` on table `cashbook_budgets` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `cashbook_budgets` DROP FOREIGN KEY `cashbook_budgets_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `cashbook_budgets` DROP FOREIGN KEY `cashbook_budgets_siteId_fkey`;

-- AlterTable
ALTER TABLE `cashbook_budgets` DROP COLUMN `companyId`,
    DROP COLUMN `description`,
    ADD COLUMN `approved1Remarks` TEXT NULL,
    ADD COLUMN `attachCopyUrl` VARCHAR(191) NULL,
    ADD COLUMN `boqName` VARCHAR(191) NULL,
    ADD COLUMN `month` VARCHAR(191) NOT NULL,
    ADD COLUMN `remarksForFinalApproval` TEXT NULL,
    MODIFY `siteId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `cashbook_budgets_month_idx` ON `cashbook_budgets`(`month`);

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
