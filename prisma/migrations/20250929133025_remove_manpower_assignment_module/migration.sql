/*
  Warnings:

  - You are about to drop the `manpower_assignments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `manpower_assignments` DROP FOREIGN KEY `manpower_assignments_manpowerId_fkey`;

-- DropForeignKey
ALTER TABLE `manpower_assignments` DROP FOREIGN KEY `manpower_assignments_siteId_fkey`;

-- DropTable
DROP TABLE `manpower_assignments`;
