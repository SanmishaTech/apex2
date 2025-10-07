-- CreateTable
CREATE TABLE `daily_progresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `boqId` INTEGER NOT NULL,
    `progressDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `daily_progresses_siteId_idx`(`siteId`),
    INDEX `daily_progresses_boqId_idx`(`boqId`),
    INDEX `daily_progresses_createdById_idx`(`createdById`),
    INDEX `daily_progresses_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_progress_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dailyProgressId` INTEGER NOT NULL,
    `boqItemId` INTEGER NOT NULL,
    `clientSerialNo` VARCHAR(191) NULL,
    `activityId` VARCHAR(191) NULL,
    `particulars` VARCHAR(191) NULL,
    `doneQty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    INDEX `daily_progress_details_dailyProgressId_idx`(`dailyProgressId`),
    INDEX `daily_progress_details_boqItemId_idx`(`boqItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_progress_hindrances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dailyProgressId` INTEGER NOT NULL,
    `from` DATETIME(3) NULL,
    `to` DATETIME(3) NULL,
    `hrs` INTEGER NULL,
    `location` VARCHAR(500) NULL,
    `reason` VARCHAR(500) NULL,

    INDEX `daily_progress_hindrances_dailyProgressId_idx`(`dailyProgressId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progress_details` ADD CONSTRAINT `daily_progress_details_dailyProgressId_fkey` FOREIGN KEY (`dailyProgressId`) REFERENCES `daily_progresses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progress_details` ADD CONSTRAINT `daily_progress_details_boqItemId_fkey` FOREIGN KEY (`boqItemId`) REFERENCES `boq_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progress_hindrances` ADD CONSTRAINT `daily_progress_hindrances_dailyProgressId_fkey` FOREIGN KEY (`dailyProgressId`) REFERENCES `daily_progresses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
