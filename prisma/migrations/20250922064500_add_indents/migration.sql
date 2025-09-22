-- CreateTable
CREATE TABLE `indents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `indentNo` VARCHAR(191) NULL,
    `indentDate` DATETIME(3) NOT NULL,
    `siteId` INTEGER NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `indents_indentNo_key`(`indentNo`),
    INDEX `indents_indentNo_idx`(`indentNo`),
    INDEX `indents_siteId_idx`(`siteId`),
    INDEX `indents_indentDate_idx`(`indentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `indent_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `indentId` INTEGER NOT NULL,
    `item` VARCHAR(191) NOT NULL,
    `closingStock` DECIMAL(12, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `remark` TEXT NULL,
    `indentQty` DECIMAL(12, 2) NOT NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `indent_items_indentId_idx`(`indentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_indentId_fkey` FOREIGN KEY (`indentId`) REFERENCES `indents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
