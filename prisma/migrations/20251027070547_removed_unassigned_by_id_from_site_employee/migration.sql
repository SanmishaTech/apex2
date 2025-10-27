/*
  Warnings:

  - You are about to drop the column `unassignedById` on the `site_employees` table. All the data in the column will be lost.
  - You are about to drop the column `unassignedDate` on the `site_employees` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `site_employees` DROP FOREIGN KEY `site_employees_unassignedById_fkey`;

-- AlterTable
ALTER TABLE `site_employees` DROP COLUMN `unassignedById`,
    DROP COLUMN `unassignedDate`;
