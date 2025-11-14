-- CreateTable
CREATE TABLE `notice_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noticeId` INTEGER NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentUrl` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notice_documents_noticeId_idx`(`noticeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notice_documents` ADD CONSTRAINT `notice_documents_noticeId_fkey` FOREIGN KEY (`noticeId`) REFERENCES `notices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
