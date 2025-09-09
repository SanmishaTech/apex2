-- CreateTable
CREATE TABLE `DesignMap` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `crackIdentificationId` INTEGER NOT NULL,
    `x` DOUBLE NOT NULL,
    `y` DOUBLE NOT NULL,
    `width` DOUBLE NOT NULL,
    `height` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DesignMap_crackIdentificationId_key`(`crackIdentificationId`),
    INDEX `DesignMap_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DesignMap` ADD CONSTRAINT `DesignMap_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DesignMap` ADD CONSTRAINT `DesignMap_crackIdentificationId_fkey` FOREIGN KEY (`crackIdentificationId`) REFERENCES `CrackIdentification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
