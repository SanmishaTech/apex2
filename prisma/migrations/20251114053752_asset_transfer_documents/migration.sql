-- DropForeignKey
ALTER TABLE `asset_documents` DROP FOREIGN KEY `asset_documents_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `company_documents` DROP FOREIGN KEY `company_documents_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `rent_documents` DROP FOREIGN KEY `rent_documents_rentId_fkey`;

-- CreateTable
CREATE TABLE `asset_transfer_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetTransferId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `asset_transfer_documents_assetTransferId_idx`(`assetTransferId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rent_documents` ADD CONSTRAINT `rent_documents_rentId_fkey` FOREIGN KEY (`rentId`) REFERENCES `rents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_documents` ADD CONSTRAINT `asset_documents_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_documents` ADD CONSTRAINT `company_documents_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfer_documents` ADD CONSTRAINT `asset_transfer_documents_assetTransferId_fkey` FOREIGN KEY (`assetTransferId`) REFERENCES `asset_transfers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
