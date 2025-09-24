-- CreateTable
CREATE TABLE `rent_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rentType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rent_types_rentType_key`(`rentType`),
    INDEX `rent_types_rentType_idx`(`rentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
