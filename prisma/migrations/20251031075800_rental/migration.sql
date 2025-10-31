/*
  Warnings:

  - You are about to drop the column `expense` on the `cashbook_details` table. All the data in the column will be lost.
  - You are about to drop the column `received` on the `cashbook_details` table. All the data in the column will be lost.
  - You are about to drop the column `challanCopyUrl` on the `manpower_transfers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `cashbook_details` DROP COLUMN `expense`,
    DROP COLUMN `received`,
    ADD COLUMN `closingQuantity` DECIMAL(12, 2) NULL,
    ADD COLUMN `openingQuantity` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `manpower_transfers` DROP COLUMN `challanCopyUrl`;
