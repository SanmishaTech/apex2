/*
  Warnings:

  - You are about to drop the column `country` on the `City` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `City` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `City` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `City` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `City` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[city]` on the table `City` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `city` to the `City` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `City` DROP FOREIGN KEY `City_createdById_fkey`;

-- DropIndex
DROP INDEX `City_name_idx` ON `City`;

-- DropIndex
DROP INDEX `City_name_state_country_key` ON `City`;

-- DropIndex
DROP INDEX `City_state_idx` ON `City`;

-- AlterTable
ALTER TABLE `City` DROP COLUMN `country`,
    DROP COLUMN `createdById`,
    DROP COLUMN `name`,
    DROP COLUMN `pincode`,
    DROP COLUMN `state`,
    ADD COLUMN `city` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `City_city_key` ON `City`(`city`);

-- CreateIndex
CREATE INDEX `City_city_idx` ON `City`(`city`);
