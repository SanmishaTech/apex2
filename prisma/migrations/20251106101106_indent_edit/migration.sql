/*
  Warnings:

  - You are about to drop the column `approvedQty` on the `indent_items` table. All the data in the column will be lost.
  - You are about to drop the column `closingStock` on the `indent_items` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryDate` on the `indent_items` table. All the data in the column will be lost.
  - You are about to drop the column `unitId` on the `indent_items` table. All the data in the column will be lost.
  - The values [APPROVED_1,APPROVED_2] on the enum `indents_approvalStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `approved1Qty` to the `indent_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `approved2Qty` to the `indent_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `indents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliveryDate` to the `indents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedById` to the `indents` table without a default value. This is not possible if the table is not empty.
  - Made the column `indentNo` on table `indents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `siteId` on table `indents` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `indent_items` DROP FOREIGN KEY `indent_items_indentId_fkey`;

-- DropForeignKey
ALTER TABLE `indent_items` DROP FOREIGN KEY `indent_items_unitId_fkey`;

-- DropForeignKey
ALTER TABLE `indents` DROP FOREIGN KEY `indents_siteId_fkey`;

-- AlterTable
ALTER TABLE `indent_items` DROP COLUMN `approvedQty`,
    DROP COLUMN `closingStock`,
    DROP COLUMN `deliveryDate`,
    DROP COLUMN `unitId`,
    ADD COLUMN `approved1Qty` DECIMAL(12, 2) NOT NULL,
    ADD COLUMN `approved2Qty` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `indents` ADD COLUMN `createdById` INTEGER NOT NULL,
    ADD COLUMN `deliveryDate` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedById` INTEGER NOT NULL,
    MODIFY `indentNo` VARCHAR(191) NOT NULL,
    MODIFY `siteId` INTEGER NOT NULL,
    MODIFY `approvalStatus` ENUM('DRAFT', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2', 'COMPLETED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX `indents_createdById_idx` ON `indents`(`createdById`);

-- CreateIndex
CREATE INDEX `indents_updatedById_idx` ON `indents`(`updatedById`);

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_indentId_fkey` FOREIGN KEY (`indentId`) REFERENCES `indents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
