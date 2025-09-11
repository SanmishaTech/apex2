-- AlterTable
ALTER TABLE `employees` ADD COLUMN `airTravelClass` VARCHAR(191) NULL,
    ADD COLUMN `busTravelClass` VARCHAR(191) NULL,
    ADD COLUMN `railwayTravelClass` VARCHAR(191) NULL,
    ADD COLUMN `reporting1Id` INTEGER NULL,
    ADD COLUMN `reporting2Id` INTEGER NULL,
    ADD COLUMN `reportingSiteAssignedDate` DATETIME(3) NULL,
    ADD COLUMN `reportingSiteId` INTEGER NULL;

-- CreateTable
CREATE TABLE `skill_sets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `skillsetName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `skill_sets_skillsetName_key`(`skillsetName`),
    INDEX `skill_sets_skillsetName_idx`(`skillsetName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `employees_reporting1Id_idx` ON `employees`(`reporting1Id`);

-- CreateIndex
CREATE INDEX `employees_reporting2Id_idx` ON `employees`(`reporting2Id`);

-- CreateIndex
CREATE INDEX `employees_reportingSiteId_idx` ON `employees`(`reportingSiteId`);

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reportingSiteId_fkey` FOREIGN KEY (`reportingSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting1Id_fkey` FOREIGN KEY (`reporting1Id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting2Id_fkey` FOREIGN KEY (`reporting2Id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
