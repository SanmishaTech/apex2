/*
  Warnings:

  - You are about to drop the column `item` on the `indent_items` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `indent_items` table. All the data in the column will be lost.
  - Added the required column `itemId` to the `indent_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitId` to the `indent_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `indent_items` DROP COLUMN `item`,
    DROP COLUMN `unit`,
    ADD COLUMN `itemId` INTEGER NOT NULL,
    ADD COLUMN `unitId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `indent_items_itemId_idx` ON `indent_items`(`itemId`);

-- CreateIndex
CREATE INDEX `indent_items_unitId_idx` ON `indent_items`(`unitId`);

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
