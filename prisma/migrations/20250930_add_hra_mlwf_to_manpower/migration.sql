-- Add HRA and MLWF fields to Manpower table
ALTER TABLE `manpower` ADD COLUMN `hra` DECIMAL(10,2);
ALTER TABLE `manpower` ADD COLUMN `mlwf` DECIMAL(10,2);
