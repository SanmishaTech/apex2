/*
  Warnings:

  - You are about to alter the column `indentQty` on the `indent_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(12,4)`.
  - You are about to alter the column `approved1Qty` on the `indent_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(12,4)`.
  - You are about to alter the column `approved2Qty` on the `indent_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(12,4)`.

*/
-- AlterTable
ALTER TABLE `indent_items` MODIFY `indentQty` DECIMAL(12, 4) NULL,
    MODIFY `approved1Qty` DECIMAL(12, 4) NULL,
    MODIFY `approved2Qty` DECIMAL(12, 4) NULL;
