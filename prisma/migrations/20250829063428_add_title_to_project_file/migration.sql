-- Safely add required 'title' column by adding nullable, backfilling, then making NOT NULL
ALTER TABLE `ProjectFile` ADD COLUMN `title` VARCHAR(191) NULL;
UPDATE `ProjectFile` SET `title` = COALESCE(`originalName`, 'Untitled') WHERE `title` IS NULL;
ALTER TABLE `ProjectFile` MODIFY `title` VARCHAR(191) NOT NULL;
