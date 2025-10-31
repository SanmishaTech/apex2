/*
  Warnings:

  - You are about to drop the column `closed` on the `sites` table. All the data in the column will be lost.
  - You are about to drop the column `monitor` on the `sites` table. All the data in the column will be lost.
  - You are about to drop the column `permanentClosed` on the `sites` table. All the data in the column will be lost.
  - You are about to drop the column `uinNo` on the `sites` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[vendorCode]` on the table `manpower_suppliers` will be added. If there are existing duplicate values, this will fail.
  - Made the column `vendorCode` on table `manpower_suppliers` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `status` to the `sites` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `sites_closed_idx` ON `sites`;

-- DropIndex
DROP INDEX `sites_monitor_idx` ON `sites`;

-- DropIndex
DROP INDEX `sites_permanentClosed_idx` ON `sites`;

-- DropIndex
DROP INDEX `sites_uinNo_idx` ON `sites`;

-- AlterTable
ALTER TABLE `manpower_suppliers` MODIFY `vendorCode` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `sites` DROP COLUMN `closed`,
    DROP COLUMN `monitor`,
    DROP COLUMN `permanentClosed`,
    DROP COLUMN `uinNo`,
    ADD COLUMN `siteCode` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `manpower_suppliers_vendorCode_key` ON `manpower_suppliers`(`vendorCode`);

-- CreateIndex
CREATE INDEX `sites_siteCode_idx` ON `sites`(`siteCode`);
