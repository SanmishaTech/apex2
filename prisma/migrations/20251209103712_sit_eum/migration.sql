/*
  Warnings:

  - You are about to alter the column `status` on the `sites` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.

*/
-- AlterTable
ALTER TABLE `sites` MODIFY `status` ENUM('ONGOING', 'HOLD', 'CLOSED', 'COMPLETED', 'MOBILIZATION_STAGE') NOT NULL;
