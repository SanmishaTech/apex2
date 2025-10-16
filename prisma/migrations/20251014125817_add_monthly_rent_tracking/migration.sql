-- AlterTable
ALTER TABLE `rents` ADD COLUMN `dueDate` DATETIME(3) NULL,
    ADD COLUMN `listStatus` VARCHAR(191) NULL,
    ADD COLUMN `srNo` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(191) NULL DEFAULT 'Unpaid';

-- CreateIndex
CREATE INDEX `rents_dueDate_idx` ON `rents`(`dueDate`);

-- CreateIndex
CREATE INDEX `rents_status_idx` ON `rents`(`status`);
