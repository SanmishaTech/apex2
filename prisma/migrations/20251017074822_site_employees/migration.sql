-- CreateTable
CREATE TABLE `site_employee_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `assignedDate` DATETIME(3) NOT NULL,
    `assignedById` INTEGER NOT NULL,
    `unassignedDate` DATETIME(3) NULL,
    `unassignedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_employee_logs_siteId_idx`(`siteId`),
    INDEX `site_employee_logs_employeeId_idx`(`employeeId`),
    INDEX `site_employee_logs_assignedById_idx`(`assignedById`),
    INDEX `site_employee_logs_unassignedById_idx`(`unassignedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `assignedDate` DATETIME(3) NOT NULL,
    `assignedById` INTEGER NOT NULL,
    `unassignedDate` DATETIME(3) NULL,
    `unassignedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_employees_siteId_idx`(`siteId`),
    INDEX `site_employees_employeeId_idx`(`employeeId`),
    INDEX `site_employees_assignedById_idx`(`assignedById`),
    INDEX `site_employees_unassignedById_idx`(`unassignedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_employee_logs` ADD CONSTRAINT `site_employee_logs_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employee_logs` ADD CONSTRAINT `site_employee_logs_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employee_logs` ADD CONSTRAINT `site_employee_logs_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employee_logs` ADD CONSTRAINT `site_employee_logs_unassignedById_fkey` FOREIGN KEY (`unassignedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employees` ADD CONSTRAINT `site_employees_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employees` ADD CONSTRAINT `site_employees_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employees` ADD CONSTRAINT `site_employees_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_employees` ADD CONSTRAINT `site_employees_unassignedById_fkey` FOREIGN KEY (`unassignedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
