/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `employees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `employees` ADD COLUMN `userId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `employees_userId_key` ON `employees`(`userId`);

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
