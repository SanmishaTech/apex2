/*
  Warnings:

  - You are about to drop the column `closingQty` on the `boq_items` table. All the data in the column will be lost.
  - You are about to drop the column `closingValue` on the `boq_items` table. All the data in the column will be lost.
  - You are about to drop the column `openingQty` on the `boq_items` table. All the data in the column will be lost.
  - You are about to drop the column `openingValue` on the `boq_items` table. All the data in the column will be lost.
  - Made the column `qty` on table `boq_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rate` on table `boq_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `amount` on table `boq_items` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `boq_items` DROP COLUMN `closingQty`,
    DROP COLUMN `closingValue`,
    DROP COLUMN `openingQty`,
    DROP COLUMN `openingValue`,
    ADD COLUMN `orderedQty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `orderedValue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `remainingQty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `remainingValue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `qty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    MODIFY `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
