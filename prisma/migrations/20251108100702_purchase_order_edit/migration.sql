/*
  Warnings:

  - Added the required column `siteDeliveryAddressId` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `purchase_orders` ADD COLUMN `siteDeliveryAddressId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_siteDeliveryAddressId_fkey` FOREIGN KEY (`siteDeliveryAddressId`) REFERENCES `site_delivery_addresses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
