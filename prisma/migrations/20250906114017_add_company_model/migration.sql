-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactNo` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pinCode` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `panNo` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `tanNo` VARCHAR(191) NULL,
    `cinNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `companies_companyName_idx`(`companyName`),
    INDEX `companies_shortName_idx`(`shortName`),
    INDEX `companies_closed_idx`(`closed`),
    INDEX `companies_stateId_idx`(`stateId`),
    INDEX `companies_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
