/*
  Warnings:

  - You are about to drop the column `siteId` on the `employees` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `employees` DROP FOREIGN KEY `employees_siteId_fkey`;

-- AlterTable
ALTER TABLE `employees` DROP COLUMN `siteId`;
