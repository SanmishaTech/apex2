/*
  Warnings:

  - You are about to drop the column `item` on the `work_order_details` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `work_order_details` table. All the data in the column will be lost.
  - Added the required column `itemId` to the `work_order_details` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `work_order_details` DROP COLUMN `item`,
    DROP COLUMN `unit`,
    ADD COLUMN `itemId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `work_order_details` ADD CONSTRAINT `work_order_details_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
