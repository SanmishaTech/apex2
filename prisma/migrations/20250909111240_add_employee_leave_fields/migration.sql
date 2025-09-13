-- AlterTable
ALTER TABLE `employees` ADD COLUMN `balanceCasualLeaves` INTEGER NULL,
    ADD COLUMN `balancePaidLeaves` INTEGER NULL,
    ADD COLUMN `balanceSickLeaves` INTEGER NULL,
    ADD COLUMN `casualLeavesPerYear` INTEGER NULL,
    ADD COLUMN `paidLeavesPerYear` INTEGER NULL,
    ADD COLUMN `sickLeavesPerYear` INTEGER NULL;
