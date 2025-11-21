/*
  Warnings:

  - A unique constraint covering the columns `[item]` on the table `items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `items_item_key` ON `items`(`item`);
