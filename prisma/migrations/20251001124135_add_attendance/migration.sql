-- CreateTable
CREATE TABLE `attendances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `siteId` INTEGER NOT NULL,
    `manpowerId` INTEGER NOT NULL,
    `isPresent` BOOLEAN NOT NULL DEFAULT false,
    `isIdle` BOOLEAN NOT NULL DEFAULT false,
    `ot` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendances_date_idx`(`date`),
    INDEX `attendances_siteId_idx`(`siteId`),
    INDEX `attendances_manpowerId_idx`(`manpowerId`),
    INDEX `attendances_isPresent_idx`(`isPresent`),
    UNIQUE INDEX `attendances_date_siteId_manpowerId_key`(`date`, `siteId`, `manpowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
