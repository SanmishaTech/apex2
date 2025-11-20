/*
  Warnings:

  - Made the column `receivedQty` on table `stock_ledgers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `issuedQty` on table `stock_ledgers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `unitRate` on table `stock_ledgers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `purchase_orders` MODIFY `purchaseOrderDate` DATETIME(3) NOT NULL,
    MODIFY `quotationDate` DATETIME(3) NOT NULL,
    MODIFY `deliveryDate` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `stock_ledgers` MODIFY `receivedQty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    MODIFY `issuedQty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    MODIFY `unitRate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `work_order_bills` MODIFY `billDate` DATETIME(3) NOT NULL,
    MODIFY `dueDate` DATETIME(3) NOT NULL,
    MODIFY `paymentDate` DATETIME(3) NOT NULL,
    MODIFY `chequeDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `work_orders` MODIFY `workOrderDate` DATETIME(3) NOT NULL,
    MODIFY `quotationDate` DATETIME(3) NOT NULL,
    MODIFY `deliveryDate` DATETIME(3) NOT NULL;
