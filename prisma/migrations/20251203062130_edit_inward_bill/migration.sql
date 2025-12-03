/*
  Warnings:

  - You are about to drop the column `deductionTax` on the `inward_bill_details` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `chequeDate` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `chequeNo` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `deductionTax` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `paidAmount` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMode` on the `inward_delivery_challans` table. All the data in the column will be lost.
  - You are about to drop the column `utrNo` on the `inward_delivery_challans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `inward_bill_details` DROP COLUMN `deductionTax`;

-- AlterTable
ALTER TABLE `inward_delivery_challans` DROP COLUMN `bankName`,
    DROP COLUMN `chequeDate`,
    DROP COLUMN `chequeNo`,
    DROP COLUMN `deductionTax`,
    DROP COLUMN `paidAmount`,
    DROP COLUMN `paymentDate`,
    DROP COLUMN `paymentMode`,
    DROP COLUMN `utrNo`,
    ADD COLUMN `dueAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
