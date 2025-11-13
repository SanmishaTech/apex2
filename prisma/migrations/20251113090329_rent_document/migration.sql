-- CreateTable
CREATE TABLE `rent_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rentId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rent_documents_rentId_idx`(`rentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rent_documents` ADD CONSTRAINT `rent_documents_rentId_fkey` FOREIGN KEY (`rentId`) REFERENCES `rents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
