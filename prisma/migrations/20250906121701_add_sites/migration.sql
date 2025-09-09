-- CreateTable
CREATE TABLE `sites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uinNo` VARCHAR(191) NULL,
    `site` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `companyId` INTEGER NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `permanentClosed` BOOLEAN NOT NULL DEFAULT false,
    `monitor` BOOLEAN NOT NULL DEFAULT false,
    `attachCopyUrl` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactNo` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pinCode` VARCHAR(191) NULL,
    `longitude` VARCHAR(191) NULL,
    `latitude` VARCHAR(191) NULL,
    `panNo` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `tanNo` VARCHAR(191) NULL,
    `cinNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sites_site_idx`(`site`),
    INDEX `sites_shortName_idx`(`shortName`),
    INDEX `sites_uinNo_idx`(`uinNo`),
    INDEX `sites_companyId_idx`(`companyId`),
    INDEX `sites_closed_idx`(`closed`),
    INDEX `sites_permanentClosed_idx`(`permanentClosed`),
    INDEX `sites_monitor_idx`(`monitor`),
    INDEX `sites_stateId_idx`(`stateId`),
    INDEX `sites_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
