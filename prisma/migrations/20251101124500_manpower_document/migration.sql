-- CreateTable
CREATE TABLE `manpower_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manpowerId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_documents_manpowerId_idx`(`manpowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `manpower_documents` ADD CONSTRAINT `manpower_documents_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
