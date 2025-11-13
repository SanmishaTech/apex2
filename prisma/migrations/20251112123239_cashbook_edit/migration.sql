/*
  Warnings:

  - Added the required column `date` to the `cashbook_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `cashbook_details` ADD COLUMN `amountPaid` DECIMAL(12, 2) NULL,
    ADD COLUMN `amountReceived` DECIMAL(12, 2) NULL,
    ADD COLUMN `date` DATETIME(3) NOT NULL,
    ADD COLUMN `documentUrl` TEXT NULL;
