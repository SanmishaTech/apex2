-- CreateTable
CREATE TABLE `work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('SUB_CONTRACT', 'PWR_WORK') NOT NULL,
    `indentId` INTEGER NULL,
    `siteId` INTEGER NOT NULL,
    `siteDeliveryAddressId` INTEGER NOT NULL,
    `paymentTermId` INTEGER NULL,
    `billingAddressId` INTEGER NOT NULL,
    `vendorId` INTEGER NOT NULL,
    `workOrderNo` VARCHAR(30) NOT NULL,
    `workOrderDate` DATE NOT NULL,
    `quotationNo` VARCHAR(100) NOT NULL,
    `quotationDate` DATE NOT NULL,
    `deliveryDate` DATE NOT NULL,
    `transport` VARCHAR(100) NULL,
    `note` TEXT NULL,
    `terms` TEXT NULL,
    `paymentTermsInDays` INTEGER NULL,
    `deliverySchedule` TEXT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `pfStatus` VARCHAR(50) NULL,
    `pfCharges` VARCHAR(50) NULL,
    `totalCgstAmount` DECIMAL(12, 2) NULL,
    `totalSgstAmount` DECIMAL(12, 2) NULL,
    `totalIgstAmount` DECIMAL(12, 2) NULL,
    `gstReverseStatus` VARCHAR(20) NULL,
    `gstReverseAmount` VARCHAR(50) NULL,
    `exciseTaxStatus` VARCHAR(20) NULL,
    `exciseTaxAmount` VARCHAR(50) NULL,
    `octroiTaxStatus` VARCHAR(20) NULL,
    `octroiTaxAmount` VARCHAR(50) NULL,
    `transitInsuranceStatus` VARCHAR(20) NULL,
    `transitInsuranceAmount` VARCHAR(50) NULL,
    `amountInWords` VARCHAR(255) NULL,
    `approvalStatus` ENUM('DRAFT', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2', 'COMPLETED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `woStatus` VARCHAR(191) NULL,
    `isApproved1` BOOLEAN NOT NULL DEFAULT false,
    `approved1ById` INTEGER NULL,
    `approved1At` DATETIME(3) NULL,
    `isApproved2` BOOLEAN NOT NULL DEFAULT false,
    `approved2ById` INTEGER NULL,
    `approved2At` DATETIME(3) NULL,
    `billStatus` VARCHAR(255) NULL,
    `remarks` VARCHAR(255) NULL,
    `isSuspended` BOOLEAN NOT NULL DEFAULT false,
    `suspendedById` INTEGER NULL,
    `suspendedAt` DATETIME(3) NULL,
    `isComplete` BOOLEAN NOT NULL DEFAULT false,
    `completedById` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `revision` INTEGER NULL,

    UNIQUE INDEX `work_orders_workOrderNo_key`(`workOrderNo`),
    INDEX `work_orders_siteId_idx`(`siteId`),
    INDEX `work_orders_indentId_idx`(`indentId`),
    INDEX `work_orders_vendorId_idx`(`vendorId`),
    INDEX `work_orders_billingAddressId_idx`(`billingAddressId`),
    INDEX `work_orders_paymentTermId_idx`(`paymentTermId`),
    INDEX `work_orders_createdById_idx`(`createdById`),
    INDEX `work_orders_updatedById_idx`(`updatedById`),
    INDEX `work_orders_approved1ById_idx`(`approved1ById`),
    INDEX `work_orders_approved2ById_idx`(`approved2ById`),
    INDEX `work_orders_suspendedById_idx`(`suspendedById`),
    INDEX `work_orders_completedById_idx`(`completedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serialNo` INTEGER NOT NULL,
    `workOrderId` INTEGER NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `sac_code` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `remark` VARCHAR(500) NULL,
    `qty` DECIMAL(12, 4) NULL,
    `orderedQty` DECIMAL(12, 4) NULL,
    `approved1Qty` DECIMAL(12, 4) NULL,
    `approved2Qty` DECIMAL(12, 4) NULL,
    `receivedQty` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `rate` DECIMAL(12, 4) NULL,
    `cgstPercent` DECIMAL(10, 2) NULL,
    `cgstAmt` DECIMAL(10, 2) NULL,
    `sgstPercent` DECIMAL(10, 2) NULL,
    `sgstAmt` DECIMAL(10, 2) NULL,
    `igstPercent` DECIMAL(10, 2) NULL,
    `igstAmt` DECIMAL(10, 2) NULL,
    `amount` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `work_order_details_workOrderId_idx`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_indentId_fkey` FOREIGN KEY (`indentId`) REFERENCES `indents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_siteDeliveryAddressId_fkey` FOREIGN KEY (`siteDeliveryAddressId`) REFERENCES `site_delivery_addresses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_paymentTermId_fkey` FOREIGN KEY (`paymentTermId`) REFERENCES `payment_terms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_billingAddressId_fkey` FOREIGN KEY (`billingAddressId`) REFERENCES `billing_addresses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_approved1ById_fkey` FOREIGN KEY (`approved1ById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_approved2ById_fkey` FOREIGN KEY (`approved2ById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_suspendedById_fkey` FOREIGN KEY (`suspendedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_order_details` ADD CONSTRAINT `work_order_details_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
