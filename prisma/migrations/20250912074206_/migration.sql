-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_unitName_key`(`unitName`),
    INDEX `units_unitName_idx`(`unitName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boqs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boqNo` VARCHAR(191) NULL,
    `siteId` INTEGER NULL,
    `workName` VARCHAR(191) NULL,
    `workOrderNo` VARCHAR(191) NULL,
    `workOrderDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `totalWorkValue` DECIMAL(12, 2) NULL,
    `gstRate` DECIMAL(5, 2) NULL,
    `agreementNo` VARCHAR(191) NULL,
    `agreementStatus` VARCHAR(191) NULL,
    `completionPeriod` VARCHAR(191) NULL,
    `completionDate` DATETIME(3) NULL,
    `dateOfExpiry` DATETIME(3) NULL,
    `commencementDate` DATETIME(3) NULL,
    `timeExtensionDate` DATETIME(3) NULL,
    `defectLiabilityPeriod` VARCHAR(191) NULL,
    `performanceSecurityMode` VARCHAR(191) NULL,
    `performanceSecurityDocumentNo` VARCHAR(191) NULL,
    `performanceSecurityPeriod` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `boqs_boqNo_key`(`boqNo`),
    INDEX `boqs_siteId_idx`(`siteId`),
    INDEX `boqs_boqNo_idx`(`boqNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boq_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boqId` INTEGER NOT NULL,
    `activityId` VARCHAR(191) NULL,
    `clientSrNo` VARCHAR(191) NULL,
    `item` VARCHAR(191) NULL,
    `unitId` INTEGER NULL,
    `qty` DECIMAL(12, 2) NULL,
    `rate` DECIMAL(12, 2) NULL,
    `amount` DECIMAL(14, 2) NULL,
    `openingQty` DECIMAL(12, 2) NULL,
    `openingValue` DECIMAL(12, 2) NULL,
    `closingQty` DECIMAL(12, 2) NULL,
    `closingValue` DECIMAL(12, 2) NULL,
    `isGroup` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `boq_items_boqId_idx`(`boqId`),
    INDEX `boq_items_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noticeHead` VARCHAR(191) NOT NULL,
    `noticeHeading` VARCHAR(191) NOT NULL,
    `noticeDescription` VARCHAR(191) NULL,
    `documentUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notices_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower_suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendorCode` VARCHAR(191) NULL,
    `supplierName` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `representativeName` VARCHAR(191) NULL,
    `localContactNo` VARCHAR(191) NULL,
    `permanentContactNo` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `state` VARCHAR(191) NULL,
    `permanentAddress` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `accountNo` VARCHAR(191) NULL,
    `ifscNo` VARCHAR(191) NULL,
    `rtgsNo` VARCHAR(191) NULL,
    `panNo` VARCHAR(191) NULL,
    `adharNo` VARCHAR(191) NULL,
    `pfNo` VARCHAR(191) NULL,
    `esicNo` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `numberOfWorkers` INTEGER NULL,
    `typeOfWork` TEXT NULL,
    `workDone` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_suppliers_supplierName_idx`(`supplierName`),
    INDEX `manpower_suppliers_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `boqs` ADD CONSTRAINT `boqs_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_items` ADD CONSTRAINT `boq_items_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_items` ADD CONSTRAINT `boq_items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
