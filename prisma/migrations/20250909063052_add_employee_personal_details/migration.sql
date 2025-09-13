-- AlterTable
ALTER TABLE `employees` ADD COLUMN `addressLine1` VARCHAR(191) NULL,
    ADD COLUMN `addressLine2` VARCHAR(191) NULL,
    ADD COLUMN `adharNo` VARCHAR(191) NULL,
    ADD COLUMN `anniversaryDate` DATETIME(3) NULL,
    ADD COLUMN `bloodGroup` VARCHAR(191) NULL,
    ADD COLUMN `cinNo` VARCHAR(191) NULL,
    ADD COLUMN `cityId` INTEGER NULL,
    ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `esic` VARCHAR(191) NULL,
    ADD COLUMN `mobile1` VARCHAR(191) NULL,
    ADD COLUMN `mobile2` VARCHAR(191) NULL,
    ADD COLUMN `panNo` VARCHAR(191) NULL,
    ADD COLUMN `pf` VARCHAR(191) NULL,
    ADD COLUMN `pincode` VARCHAR(191) NULL,
    ADD COLUMN `spouseName` VARCHAR(191) NULL,
    ADD COLUMN `stateId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `employees_stateId_idx` ON `employees`(`stateId`);

-- CreateIndex
CREATE INDEX `employees_cityId_idx` ON `employees`(`cityId`);

-- CreateIndex
CREATE INDEX `employees_dateOfBirth_idx` ON `employees`(`dateOfBirth`);

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
