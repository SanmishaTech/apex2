/*
  Warnings:

  - You are about to drop the column `closingQuantity` on the `cashbook_details` table. All the data in the column will be lost.
  - You are about to drop the column `openingQuantity` on the `cashbook_details` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `cashbook_details` DROP COLUMN `closingQuantity`,
    DROP COLUMN `openingQuantity`,
    ADD COLUMN `closingBalance` DECIMAL(12, 2) NULL,
    ADD COLUMN `openingBalance` DECIMAL(12, 2) NULL;
