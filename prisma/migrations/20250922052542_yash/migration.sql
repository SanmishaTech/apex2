/*
  Warnings:

  - You are about to drop the `cashbook_budget_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cashbook_budgets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cashbook_heads` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `cashbook_budget_items` DROP FOREIGN KEY `cashbook_budget_items_budgetId_fkey`;

-- DropForeignKey
ALTER TABLE `cashbook_budget_items` DROP FOREIGN KEY `cashbook_budget_items_cashbookHeadId_fkey`;

-- DropForeignKey
ALTER TABLE `cashbook_budgets` DROP FOREIGN KEY `cashbook_budgets_siteId_fkey`;

-- DropTable
DROP TABLE `cashbook_budget_items`;

-- DropTable
DROP TABLE `cashbook_budgets`;

-- DropTable
DROP TABLE `cashbook_heads`;
