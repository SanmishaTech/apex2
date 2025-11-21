-- DropForeignKey
ALTER TABLE `inward_delivery_challan_details` DROP FOREIGN KEY `inward_delivery_challan_details_inwardDeliveryChallanId_fkey`;

-- DropForeignKey
ALTER TABLE `inward_delivery_challan_details` DROP FOREIGN KEY `inward_delivery_challan_details_poDetailsId_fkey`;

-- DropForeignKey
ALTER TABLE `inward_delivery_challan_documents` DROP FOREIGN KEY `inward_delivery_challan_documents_inwardDeliveryChallanId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_ledgers` DROP FOREIGN KEY `stock_ledgers_inwardDeliveryChallanId_fkey`;

-- AddForeignKey
ALTER TABLE `inward_delivery_challan_details` ADD CONSTRAINT `inward_delivery_challan_details_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challan_details` ADD CONSTRAINT `inward_delivery_challan_details_poDetailsId_fkey` FOREIGN KEY (`poDetailsId`) REFERENCES `purchase_order_details`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challan_documents` ADD CONSTRAINT `inward_delivery_challan_documents_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
