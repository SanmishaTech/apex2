-- AlterTable
ALTER TABLE `cashbook_budget_items` ADD COLUMN `date` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `rents` ADD COLUMN `bankDetails` VARCHAR(191) NULL,
    ADD COLUMN `chequeDate` DATETIME(3) NULL,
    ADD COLUMN `chequeNumber` VARCHAR(191) NULL,
    ADD COLUMN `paymentDate` DATETIME(3) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `utrNumber` VARCHAR(191) NULL;
