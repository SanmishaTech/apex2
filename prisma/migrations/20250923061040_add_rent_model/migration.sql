-- CreateTable
CREATE TABLE `rents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NULL,
    `boqId` INTEGER NULL,
    `rentalCategoryId` INTEGER NULL,
    `rentTypeId` INTEGER NULL,
    `owner` VARCHAR(191) NULL,
    `pancardNo` VARCHAR(191) NULL,
    `rentDay` VARCHAR(191) NULL,
    `fromDate` DATETIME(3) NULL,
    `toDate` DATETIME(3) NULL,
    `description` VARCHAR(191) NULL,
    `depositAmount` DECIMAL(12, 2) NULL,
    `rentAmount` DECIMAL(12, 2) NULL,
    `bank` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `accountNo` VARCHAR(191) NULL,
    `accountName` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `momCopyUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rents_siteId_idx`(`siteId`),
    INDEX `rents_boqId_idx`(`boqId`),
    INDEX `rents_rentalCategoryId_idx`(`rentalCategoryId`),
    INDEX `rents_rentTypeId_idx`(`rentTypeId`),
    INDEX `rents_fromDate_idx`(`fromDate`),
    INDEX `rents_toDate_idx`(`toDate`),
    INDEX `rents_owner_idx`(`owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_rentalCategoryId_fkey` FOREIGN KEY (`rentalCategoryId`) REFERENCES `rental_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_rentTypeId_fkey` FOREIGN KEY (`rentTypeId`) REFERENCES `rent_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
