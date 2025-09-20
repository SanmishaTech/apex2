/*
  Warnings:

  - You are about to drop the column `status` on the `cities` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `states` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `cities_status_idx` ON `cities`;

-- DropIndex
DROP INDEX `units_unitName_idx` ON `units`;

-- AlterTable
ALTER TABLE `cities` DROP COLUMN `status`;

-- AlterTable
ALTER TABLE `states` DROP COLUMN `status`;

-- CreateTable
CREATE TABLE `item_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemCategoryCode` VARCHAR(191) NOT NULL,
    `itemCategory` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `item_categories_itemCategoryCode_key`(`itemCategoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemCode` VARCHAR(191) NOT NULL,
    `hsnCode` VARCHAR(191) NULL,
    `item` VARCHAR(191) NOT NULL,
    `itemCategoryId` INTEGER NULL,
    `unitId` INTEGER NULL,
    `gstRate` DECIMAL(5, 2) NULL,
    `asset` BOOLEAN NOT NULL DEFAULT false,
    `discontinue` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `items_itemCode_key`(`itemCode`),
    INDEX `items_itemCode_idx`(`itemCode`),
    INDEX `items_itemCategoryId_idx`(`itemCategoryId`),
    INDEX `items_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pincode` VARCHAR(191) NULL,
    `landline1` VARCHAR(191) NULL,
    `landline2` VARCHAR(191) NULL,
    `fax` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `vatTinNumber` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `cstTinNumber` VARCHAR(191) NULL,
    `cinNumber` VARCHAR(191) NULL,
    `stateCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `billing_addresses_companyName_idx`(`companyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendorName` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pincode` VARCHAR(191) NULL,
    `mobile1` VARCHAR(191) NULL,
    `mobile2` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `alternateEmail1` VARCHAR(191) NULL,
    `alternateEmail2` VARCHAR(191) NULL,
    `alternateEmail3` VARCHAR(191) NULL,
    `alternateEmail4` VARCHAR(191) NULL,
    `landline1` VARCHAR(191) NULL,
    `landline2` VARCHAR(191) NULL,
    `bank` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `branchCode` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `vatTinNumber` VARCHAR(191) NULL,
    `cstTinNumber` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `cinNumber` VARCHAR(191) NULL,
    `serviceTaxNumber` VARCHAR(191) NULL,
    `stateCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendors_vendorName_idx`(`vendorName`),
    INDEX `vendors_email_idx`(`email`),
    INDEX `vendors_gstNumber_idx`(`gstNumber`),
    INDEX `vendors_stateId_idx`(`stateId`),
    INDEX `vendors_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_item_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendorId` INTEGER NOT NULL,
    `itemCategoryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vendor_item_categories_vendorId_idx`(`vendorId`),
    INDEX `vendor_item_categories_itemCategoryId_idx`(`itemCategoryId`),
    UNIQUE INDEX `vendor_item_categories_vendorId_itemCategoryId_key`(`vendorId`, `itemCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boq_targets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `boqId` INTEGER NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `fromTargetDate` DATETIME(3) NOT NULL,
    `toTargetDate` DATETIME(3) NOT NULL,
    `dailyTargetQty` DECIMAL(12, 2) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `boq_targets_siteId_idx`(`siteId`),
    INDEX `boq_targets_boqId_idx`(`boqId`),
    INDEX `boq_targets_activityId_idx`(`activityId`),
    INDEX `boq_targets_fromTargetDate_idx`(`fromTargetDate`),
    INDEX `boq_targets_toTargetDate_idx`(`toTargetDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstName` VARCHAR(191) NOT NULL,
    `middleName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `location` VARCHAR(191) NULL,
    `mobileNumber` VARCHAR(191) NULL,
    `wage` DECIMAL(12, 2) NULL,
    `bank` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `pfNo` VARCHAR(191) NULL,
    `esicNo` VARCHAR(191) NULL,
    `unaNo` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `panDocumentUrl` VARCHAR(191) NULL,
    `aadharNo` VARCHAR(191) NULL,
    `aadharDocumentUrl` VARCHAR(191) NULL,
    `voterIdNo` VARCHAR(191) NULL,
    `voterIdDocumentUrl` VARCHAR(191) NULL,
    `drivingLicenceNo` VARCHAR(191) NULL,
    `drivingLicenceDocumentUrl` VARCHAR(191) NULL,
    `bankDetailsDocumentUrl` VARCHAR(191) NULL,
    `bankDetails` VARCHAR(191) NULL,
    `watch` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_supplierId_idx`(`supplierId`),
    INDEX `manpower_firstName_lastName_idx`(`firstName`, `lastName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `minimum_wages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `skillSetId` INTEGER NOT NULL,
    `minWage` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `minimum_wages_siteId_idx`(`siteId`),
    INDEX `minimum_wages_categoryId_idx`(`categoryId`),
    INDEX `minimum_wages_skillSetId_idx`(`skillSetId`),
    UNIQUE INDEX `minimum_wages_siteId_categoryId_skillSetId_key`(`siteId`, `categoryId`, `skillSetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_itemCategoryId_fkey` FOREIGN KEY (`itemCategoryId`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_addresses` ADD CONSTRAINT `billing_addresses_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_addresses` ADD CONSTRAINT `billing_addresses_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_item_categories` ADD CONSTRAINT `vendor_item_categories_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_item_categories` ADD CONSTRAINT `vendor_item_categories_itemCategoryId_fkey` FOREIGN KEY (`itemCategoryId`) REFERENCES `item_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_targets` ADD CONSTRAINT `boq_targets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_targets` ADD CONSTRAINT `boq_targets_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower` ADD CONSTRAINT `manpower_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `manpower_suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minimum_wages` ADD CONSTRAINT `minimum_wages_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minimum_wages` ADD CONSTRAINT `minimum_wages_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minimum_wages` ADD CONSTRAINT `minimum_wages_skillSetId_fkey` FOREIGN KEY (`skillSetId`) REFERENCES `skill_sets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
