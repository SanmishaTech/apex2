-- CreateTable
CREATE TABLE `Block` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Block_projectId_idx`(`projectId`),
    UNIQUE INDEX `Block_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CrackIdentification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `blockId` INTEGER NOT NULL,
    `chainageFrom` VARCHAR(191) NULL,
    `chainageTo` VARCHAR(191) NULL,
    `rl` DOUBLE NULL,
    `lengthMm` DOUBLE NULL,
    `widthMm` DOUBLE NULL,
    `heightMm` DOUBLE NULL,
    `defectType` VARCHAR(191) NULL,
    `videoFileName` VARCHAR(191) NULL,
    `startTime` CHAR(8) NULL,
    `endTime` CHAR(8) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CrackIdentification_projectId_idx`(`projectId`),
    INDEX `CrackIdentification_blockId_idx`(`blockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrackIdentification` ADD CONSTRAINT `CrackIdentification_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrackIdentification` ADD CONSTRAINT `CrackIdentification_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `Block`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
