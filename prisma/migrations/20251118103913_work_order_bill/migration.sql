-- CreateTable
CREATE TABLE `work_order_bills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workOrderId` INTEGER NOT NULL,
    `billNo` VARCHAR(50) NOT NULL,
    `billDate` DATE NOT NULL,
    `billAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `paidAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `dueDate` DATE NOT NULL,
    `paymentDate` DATE NOT NULL,
    `paymentMode` VARCHAR(50) NOT NULL,
    `chequeNo` VARCHAR(200) NULL,
    `chequeDate` DATE NULL,
    `utrNo` VARCHAR(200) NULL,
    `bankName` VARCHAR(100) NULL,
    `deductionTax` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `dueAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('PAID', 'UNPAID', 'PARTIALLY_PAID') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_order_bills` ADD CONSTRAINT `work_order_bills_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `work_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
