-- CreateTable
CREATE TABLE `inward_bill_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inwardDeliveryChallanId` INTEGER NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `paymentMode` VARCHAR(20) NOT NULL,
    `chequeNo` VARCHAR(30) NULL,
    `chequeDate` DATETIME(3) NULL,
    `utrNo` VARCHAR(50) NULL,
    `rtgsDate` DATETIME(3) NULL,
    `neftDate` DATETIME(3) NULL,
    `transactionNo` VARCHAR(30) NULL,
    `transactionDate` DATETIME(3) NULL,
    `bankName` VARCHAR(50) NULL,
    `deductionTax` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inward_bill_details_inwardDeliveryChallanId_idx`(`inwardDeliveryChallanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inward_bill_details` ADD CONSTRAINT `inward_bill_details_inwardDeliveryChallanId_fkey` FOREIGN KEY (`inwardDeliveryChallanId`) REFERENCES `inward_delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
