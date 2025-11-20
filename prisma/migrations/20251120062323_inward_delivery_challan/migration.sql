-- CreateTable
CREATE TABLE `inward_delivery_challans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchaseOrderId` INTEGER NOT NULL,
    `vendorId` INTEGER NOT NULL,
    `siteId` INTEGER NOT NULL,
    `inwardChallanNo` VARCHAR(50) NOT NULL,
    `inwardChallanDate` DATETIME(3) NOT NULL,
    `challanNo` VARCHAR(100) NOT NULL,
    `challanDate` DATETIME(3) NOT NULL,
    `lrNo` VARCHAR(100) NULL,
    `lRDate` DATETIME(3) NULL,
    `invoiceNo` VARCHAR(100) NULL,
    `invoiceDate` DATETIME(3) NULL,
    `billNo` VARCHAR(100) NULL,
    `billDate` DATETIME(3) NULL,
    `vehicleNo` VARCHAR(50) NULL,
    `remarks` VARCHAR(255) NULL,
    `billAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `deductionTax` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `dueDays` INTEGER NOT NULL DEFAULT 0,
    `dueDate` DATETIME(3) NULL,
    `paymentMode` VARCHAR(20) NULL,
    `paymentDate` DATETIME(3) NULL,
    `status` ENUM('PAID', 'UNPAID', 'PARTIALLY_PAID') NOT NULL DEFAULT 'UNPAID',
    `chequeNo` VARCHAR(250) NULL,
    `chequeDate` DATETIME(3) NULL,
    `utrNo` VARCHAR(250) NULL,
    `bankName` VARCHAR(100) NULL,
    `totalPaidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inward_delivery_challans_purchaseOrderId_key`(`purchaseOrderId`),
    INDEX `inward_delivery_challans_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `inward_delivery_challans_vendorId_idx`(`vendorId`),
    INDEX `inward_delivery_challans_siteId_idx`(`siteId`),
    INDEX `inward_delivery_challans_createdById_idx`(`createdById`),
    INDEX `inward_delivery_challans_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inward_delivery_challan_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inwardDeliveryChallanId` INTEGER NOT NULL,
    `poDetailsId` INTEGER NOT NULL,
    `receivingQty` DECIMAL(12, 4) NOT NULL DEFAULT 0.00,
    `rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inward_delivery_challan_details_poDetailsId_key`(`poDetailsId`),
    INDEX `inward_delivery_challan_details_inwardDeliveryChallanId_idx`(`inwardDeliveryChallanId`),
    INDEX `inward_delivery_challan_details_poDetailsId_idx`(`poDetailsId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inward_delivery_challan_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inwardDeliveryChallanId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inward_delivery_challan_documents_inwardDeliveryChallanId_idx`(`inwardDeliveryChallanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_ledgers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `transactionDate` DATETIME(3) NOT NULL,
    `itemId` INTEGER NOT NULL,
    `inwardDeliveryChallanId` INTEGER NOT NULL,
    `receivedQty` DECIMAL(12, 4) NULL,
    `issuedQty` DECIMAL(12, 4) NULL,
    `unitRate` DECIMAL(12, 2) NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_ledgers_siteId_idx`(`siteId`),
    INDEX `stock_ledgers_itemId_idx`(`itemId`),
    INDEX `stock_ledgers_inwardDeliveryChallanId_idx`(`inwardDeliveryChallanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inward_delivery_challans` ADD CONSTRAINT `inward_delivery_challans_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challans` ADD CONSTRAINT `inward_delivery_challans_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challans` ADD CONSTRAINT `inward_delivery_challans_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challans` ADD CONSTRAINT `inward_delivery_challans_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challans` ADD CONSTRAINT `inward_delivery_challans_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challan_details` ADD CONSTRAINT `inward_delivery_challan_details_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challan_details` ADD CONSTRAINT `inward_delivery_challan_details_poDetailsId_fkey` FOREIGN KEY (`poDetailsId`) REFERENCES `purchase_order_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inward_delivery_challan_documents` ADD CONSTRAINT `inward_delivery_challan_documents_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `work_order_bills` RENAME INDEX `work_order_bills_workOrderId_fkey` TO `work_order_bills_workOrderId_idx`;
