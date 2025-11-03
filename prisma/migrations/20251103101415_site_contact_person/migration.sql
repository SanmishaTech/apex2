-- CreateTable
CREATE TABLE `site_contact_persons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactNo` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_contact_persons_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_contact_persons` ADD CONSTRAINT `site_contact_persons_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
