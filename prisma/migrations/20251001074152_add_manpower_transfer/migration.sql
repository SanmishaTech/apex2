-- CreateTable
CREATE TABLE `manpower_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challanNo` VARCHAR(191) NOT NULL,
    `challanDate` DATETIME(3) NOT NULL,
    `fromSiteId` INTEGER NOT NULL,
    `toSiteId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `challanCopyUrl` VARCHAR(191) NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manpower_transfers_challanNo_key`(`challanNo`),
    INDEX `manpower_transfers_challanNo_idx`(`challanNo`),
    INDEX `manpower_transfers_fromSiteId_idx`(`fromSiteId`),
    INDEX `manpower_transfers_toSiteId_idx`(`toSiteId`),
    INDEX `manpower_transfers_status_idx`(`status`),
    INDEX `manpower_transfers_challanDate_idx`(`challanDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manpowerTransferId` INTEGER NOT NULL,
    `manpowerId` INTEGER NOT NULL,
    `category` VARCHAR(191) NULL,
    `skillSet` VARCHAR(191) NULL,
    `wage` DECIMAL(12, 2) NULL,
    `minWage` DECIMAL(10, 2) NULL,
    `hours` DECIMAL(5, 2) NULL,
    `esic` DECIMAL(10, 2) NULL,
    `pf` BOOLEAN NOT NULL DEFAULT false,
    `pt` DECIMAL(10, 2) NULL,
    `hra` DECIMAL(10, 2) NULL,
    `mlwf` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_transfer_items_manpowerTransferId_idx`(`manpowerTransferId`),
    INDEX `manpower_transfer_items_manpowerId_idx`(`manpowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `manpower_transfers` ADD CONSTRAINT `manpower_transfers_fromSiteId_fkey` FOREIGN KEY (`fromSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfers` ADD CONSTRAINT `manpower_transfers_toSiteId_fkey` FOREIGN KEY (`toSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfers` ADD CONSTRAINT `manpower_transfers_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfer_items` ADD CONSTRAINT `manpower_transfer_items_manpowerTransferId_fkey` FOREIGN KEY (`manpowerTransferId`) REFERENCES `manpower_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfer_items` ADD CONSTRAINT `manpower_transfer_items_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
