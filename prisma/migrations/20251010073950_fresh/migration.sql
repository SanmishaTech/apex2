-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `profilePhoto` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `verificationToken` VARCHAR(191) NULL,
    `verificationTokenExpiry` DATETIME(3) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `lastLogin` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_verificationToken_key`(`verificationToken`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `replacedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `city` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `stateId` INTEGER NULL,

    UNIQUE INDEX `cities_city_key`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactNo` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pinCode` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `panNo` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `tanNo` VARCHAR(191) NULL,
    `cinNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `companies_companyName_idx`(`companyName`),
    INDEX `companies_shortName_idx`(`shortName`),
    INDEX `companies_closed_idx`(`closed`),
    INDEX `companies_stateId_idx`(`stateId`),
    INDEX `companies_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uinNo` VARCHAR(191) NULL,
    `site` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `companyId` INTEGER NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `permanentClosed` BOOLEAN NOT NULL DEFAULT false,
    `monitor` BOOLEAN NOT NULL DEFAULT false,
    `attachCopyUrl` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactNo` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pinCode` VARCHAR(191) NULL,
    `longitude` VARCHAR(191) NULL,
    `latitude` VARCHAR(191) NULL,
    `panNo` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `tanNo` VARCHAR(191) NULL,
    `cinNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sites_site_idx`(`site`),
    INDEX `sites_shortName_idx`(`shortName`),
    INDEX `sites_uinNo_idx`(`uinNo`),
    INDEX `sites_companyId_idx`(`companyId`),
    INDEX `sites_closed_idx`(`closed`),
    INDEX `sites_permanentClosed_idx`(`permanentClosed`),
    INDEX `sites_monitor_idx`(`monitor`),
    INDEX `sites_stateId_idx`(`stateId`),
    INDEX `sites_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `department` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_department_key`(`department`),
    INDEX `departments_department_idx`(`department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rent_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rentType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rent_types_rentType_key`(`rentType`),
    INDEX `rent_types_rentType_idx`(`rentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `departmentId` INTEGER NULL,
    `siteId` INTEGER NULL,
    `reportingSiteId` INTEGER NULL,
    `reportingSiteAssignedDate` DATETIME(3) NULL,
    `resignDate` DATETIME(3) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `anniversaryDate` DATETIME(3) NULL,
    `spouseName` VARCHAR(191) NULL,
    `bloodGroup` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pincode` VARCHAR(191) NULL,
    `mobile1` VARCHAR(191) NULL,
    `mobile2` VARCHAR(191) NULL,
    `esic` VARCHAR(191) NULL,
    `pf` VARCHAR(191) NULL,
    `panNo` VARCHAR(191) NULL,
    `adharNo` VARCHAR(191) NULL,
    `cinNo` VARCHAR(191) NULL,
    `airTravelClass` VARCHAR(191) NULL,
    `railwayTravelClass` VARCHAR(191) NULL,
    `busTravelClass` VARCHAR(191) NULL,
    `reporting1Id` INTEGER NULL,
    `reporting2Id` INTEGER NULL,
    `sickLeavesPerYear` INTEGER NULL,
    `paidLeavesPerYear` INTEGER NULL,
    `casualLeavesPerYear` INTEGER NULL,
    `balanceSickLeaves` INTEGER NULL,
    `balancePaidLeaves` INTEGER NULL,
    `balanceCasualLeaves` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_userId_key`(`userId`),
    INDEX `employees_name_idx`(`name`),
    INDEX `employees_departmentId_idx`(`departmentId`),
    INDEX `employees_siteId_idx`(`siteId`),
    INDEX `employees_resignDate_idx`(`resignDate`),
    INDEX `employees_stateId_idx`(`stateId`),
    INDEX `employees_cityId_idx`(`cityId`),
    INDEX `employees_dateOfBirth_idx`(`dateOfBirth`),
    INDEX `employees_reporting1Id_idx`(`reporting1Id`),
    INDEX `employees_reporting2Id_idx`(`reporting2Id`),
    INDEX `employees_reportingSiteId_idx`(`reportingSiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_categoryName_key`(`categoryName`),
    INDEX `categories_categoryName_idx`(`categoryName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rental_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rentalCategory` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rental_categories_rentalCategory_key`(`rentalCategory`),
    INDEX `rental_categories_rentalCategory_idx`(`rentalCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_sets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `skillsetName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `skill_sets_skillsetName_key`(`skillsetName`),
    INDEX `skill_sets_skillsetName_idx`(`skillsetName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `states` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `state` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `states_state_key`(`state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `units_unitName_key`(`unitName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetGroupName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_groups_assetGroupName_key`(`assetGroupName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetGroupId` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `asset_categories_assetGroupId_idx`(`assetGroupId`),
    UNIQUE INDEX `asset_categories_assetGroupId_category_key`(`assetGroupId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetNo` VARCHAR(191) NOT NULL,
    `assetGroupId` INTEGER NOT NULL,
    `assetCategoryId` INTEGER NOT NULL,
    `assetName` VARCHAR(191) NOT NULL,
    `make` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `purchaseDate` DATETIME(3) NULL,
    `invoiceNo` VARCHAR(191) NULL,
    `supplier` VARCHAR(191) NULL,
    `invoiceCopyUrl` VARCHAR(191) NULL,
    `nextMaintenanceDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Working',
    `useStatus` VARCHAR(191) NOT NULL DEFAULT 'In Use',
    `transferStatus` VARCHAR(191) NOT NULL DEFAULT 'Available',
    `currentSiteId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assets_assetNo_key`(`assetNo`),
    INDEX `assets_assetNo_idx`(`assetNo`),
    INDEX `assets_assetGroupId_idx`(`assetGroupId`),
    INDEX `assets_assetCategoryId_idx`(`assetCategoryId`),
    INDEX `assets_assetName_idx`(`assetName`),
    INDEX `assets_status_idx`(`status`),
    INDEX `assets_useStatus_idx`(`useStatus`),
    INDEX `assets_transferStatus_idx`(`transferStatus`),
    INDEX `assets_currentSiteId_idx`(`currentSiteId`),
    INDEX `assets_purchaseDate_idx`(`purchaseDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemCategoryCode` VARCHAR(191) NOT NULL,
    `itemCategory` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `item_categories_itemCategoryCode_key`(`itemCategoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemCode` VARCHAR(191) NOT NULL,
    `hsnCode` VARCHAR(191) NULL,
    `item` VARCHAR(191) NOT NULL,
    `itemCategoryId` INTEGER NULL,
    `unitId` INTEGER NULL,
    `gstRate` DECIMAL(5, 2) NULL,
    `asset` BOOLEAN NOT NULL DEFAULT false,
    `discontinue` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `items_itemCode_key`(`itemCode`),
    INDEX `items_itemCode_idx`(`itemCode`),
    INDEX `items_itemCategoryId_idx`(`itemCategoryId`),
    INDEX `items_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(191) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pincode` VARCHAR(191) NULL,
    `landline1` VARCHAR(191) NULL,
    `landline2` VARCHAR(191) NULL,
    `fax` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `vatTinNumber` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `cstTinNumber` VARCHAR(191) NULL,
    `cinNumber` VARCHAR(191) NULL,
    `stateCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `billing_addresses_companyName_idx`(`companyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendorName` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `stateId` INTEGER NULL,
    `cityId` INTEGER NULL,
    `pincode` VARCHAR(191) NULL,
    `mobile1` VARCHAR(191) NULL,
    `mobile2` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `alternateEmail1` VARCHAR(191) NULL,
    `alternateEmail2` VARCHAR(191) NULL,
    `alternateEmail3` VARCHAR(191) NULL,
    `alternateEmail4` VARCHAR(191) NULL,
    `landline1` VARCHAR(191) NULL,
    `landline2` VARCHAR(191) NULL,
    `bank` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `branchCode` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `vatTinNumber` VARCHAR(191) NULL,
    `cstTinNumber` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `cinNumber` VARCHAR(191) NULL,
    `serviceTaxNumber` VARCHAR(191) NULL,
    `stateCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendors_vendorName_idx`(`vendorName`),
    INDEX `vendors_email_idx`(`email`),
    INDEX `vendors_gstNumber_idx`(`gstNumber`),
    INDEX `vendors_stateId_idx`(`stateId`),
    INDEX `vendors_cityId_idx`(`cityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_item_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendorId` INTEGER NOT NULL,
    `itemCategoryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vendor_item_categories_vendorId_idx`(`vendorId`),
    INDEX `vendor_item_categories_itemCategoryId_idx`(`itemCategoryId`),
    UNIQUE INDEX `vendor_item_categories_vendorId_itemCategoryId_key`(`vendorId`, `itemCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boqs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boqNo` VARCHAR(191) NULL,
    `siteId` INTEGER NULL,
    `workName` VARCHAR(191) NULL,
    `workOrderNo` VARCHAR(191) NULL,
    `workOrderDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `totalWorkValue` DECIMAL(12, 2) NULL,
    `gstRate` DECIMAL(5, 2) NULL,
    `agreementNo` VARCHAR(191) NULL,
    `agreementStatus` VARCHAR(191) NULL,
    `completionPeriod` VARCHAR(191) NULL,
    `completionDate` DATETIME(3) NULL,
    `dateOfExpiry` DATETIME(3) NULL,
    `commencementDate` DATETIME(3) NULL,
    `timeExtensionDate` DATETIME(3) NULL,
    `defectLiabilityPeriod` VARCHAR(191) NULL,
    `performanceSecurityMode` VARCHAR(191) NULL,
    `performanceSecurityDocumentNo` VARCHAR(191) NULL,
    `performanceSecurityPeriod` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `boqs_boqNo_key`(`boqNo`),
    INDEX `boqs_siteId_idx`(`siteId`),
    INDEX `boqs_boqNo_idx`(`boqNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boq_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boqId` INTEGER NOT NULL,
    `activityId` VARCHAR(191) NULL,
    `clientSrNo` VARCHAR(191) NULL,
    `item` VARCHAR(191) NULL,
    `unitId` INTEGER NULL,
    `qty` DECIMAL(12, 2) NULL,
    `rate` DECIMAL(12, 2) NULL,
    `amount` DECIMAL(14, 2) NULL,
    `openingQty` DECIMAL(12, 2) NULL,
    `openingValue` DECIMAL(12, 2) NULL,
    `closingQty` DECIMAL(12, 2) NULL,
    `closingValue` DECIMAL(12, 2) NULL,
    `isGroup` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `boq_items_boqId_idx`(`boqId`),
    INDEX `boq_items_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boq_targets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `boqId` INTEGER NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `fromTargetDate` DATETIME(3) NOT NULL,
    `toTargetDate` DATETIME(3) NOT NULL,
    `dailyTargetQty` DECIMAL(12, 2) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `boq_targets_siteId_idx`(`siteId`),
    INDEX `boq_targets_boqId_idx`(`boqId`),
    INDEX `boq_targets_activityId_idx`(`activityId`),
    INDEX `boq_targets_fromTargetDate_idx`(`fromTargetDate`),
    INDEX `boq_targets_toTargetDate_idx`(`toTargetDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noticeHead` VARCHAR(191) NOT NULL,
    `noticeHeading` VARCHAR(191) NOT NULL,
    `noticeDescription` VARCHAR(191) NULL,
    `documentUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notices_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower_suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendorCode` VARCHAR(191) NULL,
    `supplierName` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `representativeName` VARCHAR(191) NULL,
    `localContactNo` VARCHAR(191) NULL,
    `permanentContactNo` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `state` VARCHAR(191) NULL,
    `permanentAddress` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `accountNo` VARCHAR(191) NULL,
    `ifscNo` VARCHAR(191) NULL,
    `rtgsNo` VARCHAR(191) NULL,
    `panNo` VARCHAR(191) NULL,
    `adharNo` VARCHAR(191) NULL,
    `pfNo` VARCHAR(191) NULL,
    `esicNo` VARCHAR(191) NULL,
    `gstNo` VARCHAR(191) NULL,
    `numberOfWorkers` INTEGER NULL,
    `typeOfWork` TEXT NULL,
    `workDone` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_suppliers_supplierName_idx`(`supplierName`),
    INDEX `manpower_suppliers_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstName` VARCHAR(191) NOT NULL,
    `middleName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `supplierId` INTEGER NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `address` TEXT NULL,
    `location` VARCHAR(191) NULL,
    `mobileNumber` VARCHAR(191) NULL,
    `wage` DECIMAL(12, 2) NULL,
    `bank` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `pfNo` VARCHAR(191) NULL,
    `esicNo` VARCHAR(191) NULL,
    `unaNo` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `panDocumentUrl` VARCHAR(191) NULL,
    `aadharNo` VARCHAR(191) NULL,
    `aadharDocumentUrl` VARCHAR(191) NULL,
    `voterIdNo` VARCHAR(191) NULL,
    `voterIdDocumentUrl` VARCHAR(191) NULL,
    `drivingLicenceNo` VARCHAR(191) NULL,
    `drivingLicenceDocumentUrl` VARCHAR(191) NULL,
    `bankDetailsDocumentUrl` VARCHAR(191) NULL,
    `bankDetails` VARCHAR(191) NULL,
    `watch` BOOLEAN NOT NULL DEFAULT false,
    `category` VARCHAR(191) NULL,
    `skillSet` VARCHAR(191) NULL,
    `minWage` DECIMAL(10, 2) NULL,
    `hours` DECIMAL(5, 2) NULL,
    `esic` DECIMAL(10, 2) NULL,
    `pf` BOOLEAN NOT NULL DEFAULT false,
    `pt` DECIMAL(10, 2) NULL,
    `hra` DECIMAL(10, 2) NULL,
    `mlwf` DECIMAL(10, 2) NULL,
    `isAssigned` BOOLEAN NOT NULL DEFAULT false,
    `currentSiteId` INTEGER NULL,
    `assignedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_supplierId_idx`(`supplierId`),
    INDEX `manpower_firstName_lastName_idx`(`firstName`, `lastName`),
    INDEX `manpower_isAssigned_idx`(`isAssigned`),
    INDEX `manpower_currentSiteId_idx`(`currentSiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `minimum_wages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `skillSetId` INTEGER NOT NULL,
    `minWage` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `minimum_wages_siteId_idx`(`siteId`),
    INDEX `minimum_wages_categoryId_idx`(`categoryId`),
    INDEX `minimum_wages_skillSetId_idx`(`skillSetId`),
    UNIQUE INDEX `minimum_wages_siteId_categoryId_skillSetId_key`(`siteId`, `categoryId`, `skillSetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_terms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentTerm` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_terms_paymentTerm_key`(`paymentTerm`),
    INDEX `payment_terms_paymentTerm_idx`(`paymentTerm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_heads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashbookHeadName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cashbook_heads_cashbookHeadName_key`(`cashbookHeadName`),
    INDEX `cashbook_heads_cashbookHeadName_idx`(`cashbookHeadName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `siteId` INTEGER NULL,
    `boqName` VARCHAR(191) NULL,
    `attachCopyUrl` VARCHAR(191) NULL,
    `approved1Remarks` TEXT NULL,
    `remarksForFinalApproval` TEXT NULL,
    `totalBudget` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_budgets_name_idx`(`name`),
    INDEX `cashbook_budgets_month_idx`(`month`),
    INDEX `cashbook_budgets_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_budget_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `budgetId` INTEGER NOT NULL,
    `cashbookHeadId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_budget_items_budgetId_idx`(`budgetId`),
    INDEX `cashbook_budget_items_cashbookHeadId_idx`(`cashbookHeadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `indents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `indentNo` VARCHAR(191) NULL,
    `indentDate` DATETIME(3) NOT NULL,
    `siteId` INTEGER NULL,
    `approvalStatus` ENUM('DRAFT', 'APPROVED_1', 'APPROVED_2', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    `approved1ById` INTEGER NULL,
    `approved1At` DATETIME(3) NULL,
    `approved2ById` INTEGER NULL,
    `approved2At` DATETIME(3) NULL,
    `completedById` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,
    `suspended` BOOLEAN NOT NULL DEFAULT false,
    `suspendedById` INTEGER NULL,
    `suspendedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `indents_indentNo_key`(`indentNo`),
    INDEX `indents_indentNo_idx`(`indentNo`),
    INDEX `indents_siteId_idx`(`siteId`),
    INDEX `indents_indentDate_idx`(`indentDate`),
    INDEX `indents_approvalStatus_idx`(`approvalStatus`),
    INDEX `indents_suspended_idx`(`suspended`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `indent_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `indentId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `closingStock` DECIMAL(12, 2) NOT NULL,
    `unitId` INTEGER NOT NULL,
    `remark` TEXT NULL,
    `indentQty` DECIMAL(12, 2) NOT NULL,
    `approvedQty` DECIMAL(12, 2) NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `indent_items_indentId_idx`(`indentId`),
    INDEX `indent_items_itemId_idx`(`itemId`),
    INDEX `indent_items_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `budgetQty` DECIMAL(12, 2) NOT NULL,
    `budgetRate` DECIMAL(12, 2) NOT NULL,
    `purchaseRate` DECIMAL(12, 2) NOT NULL,
    `budgetValue` DECIMAL(12, 2) NOT NULL,
    `orderedQty` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `avgRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `orderedValue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `qty50Alert` BOOLEAN NOT NULL DEFAULT false,
    `value50Alert` BOOLEAN NOT NULL DEFAULT false,
    `qty75Alert` BOOLEAN NOT NULL DEFAULT false,
    `value75Alert` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `site_budgets_siteId_idx`(`siteId`),
    INDEX `site_budgets_itemId_idx`(`itemId`),
    UNIQUE INDEX `site_budgets_siteId_itemId_key`(`siteId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NULL,
    `boqId` INTEGER NULL,
    `rentalCategoryId` INTEGER NULL,
    `rentTypeId` INTEGER NULL,
    `owner` VARCHAR(191) NULL,
    `pancardNo` VARCHAR(191) NULL,
    `rentDay` VARCHAR(191) NULL,
    `fromDate` DATETIME(3) NULL,
    `toDate` DATETIME(3) NULL,
    `description` VARCHAR(191) NULL,
    `depositAmount` DECIMAL(12, 2) NULL,
    `rentAmount` DECIMAL(12, 2) NULL,
    `bank` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `accountNo` VARCHAR(191) NULL,
    `accountName` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `momCopyUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rents_siteId_idx`(`siteId`),
    INDEX `rents_boqId_idx`(`boqId`),
    INDEX `rents_rentalCategoryId_idx`(`rentalCategoryId`),
    INDEX `rents_rentTypeId_idx`(`rentTypeId`),
    INDEX `rents_fromDate_idx`(`fromDate`),
    INDEX `rents_toDate_idx`(`toDate`),
    INDEX `rents_owner_idx`(`owner`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbooks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucherNo` VARCHAR(191) NULL,
    `voucherDate` DATETIME(3) NOT NULL,
    `siteId` INTEGER NULL,
    `boqId` INTEGER NULL,
    `attachVoucherCopyUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cashbooks_voucherNo_key`(`voucherNo`),
    INDEX `cashbooks_voucherNo_idx`(`voucherNo`),
    INDEX `cashbooks_siteId_idx`(`siteId`),
    INDEX `cashbooks_boqId_idx`(`boqId`),
    INDEX `cashbooks_voucherDate_idx`(`voucherDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbook_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashbookId` INTEGER NOT NULL,
    `cashbookHeadId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `received` DECIMAL(12, 2) NULL,
    `expense` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cashbook_details_cashbookId_idx`(`cashbookId`),
    INDEX `cashbook_details_cashbookHeadId_idx`(`cashbookHeadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challanNo` VARCHAR(191) NOT NULL,
    `challanDate` DATETIME(3) NOT NULL,
    `transferType` VARCHAR(191) NOT NULL,
    `fromSiteId` INTEGER NULL,
    `toSiteId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `challanCopyUrl` VARCHAR(191) NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_transfers_challanNo_key`(`challanNo`),
    INDEX `asset_transfers_challanNo_idx`(`challanNo`),
    INDEX `asset_transfers_fromSiteId_idx`(`fromSiteId`),
    INDEX `asset_transfers_toSiteId_idx`(`toSiteId`),
    INDEX `asset_transfers_status_idx`(`status`),
    INDEX `asset_transfers_transferType_idx`(`transferType`),
    INDEX `asset_transfers_challanDate_idx`(`challanDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetTransferId` INTEGER NOT NULL,
    `assetId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `siteId` INTEGER NOT NULL,
    `manpowerId` INTEGER NOT NULL,
    `isPresent` BOOLEAN NOT NULL DEFAULT false,
    `isIdle` BOOLEAN NOT NULL DEFAULT false,
    `ot` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendances_date_idx`(`date`),
    INDEX `attendances_siteId_idx`(`siteId`),
    INDEX `attendances_manpowerId_idx`(`manpowerId`),
    INDEX `attendances_isPresent_idx`(`isPresent`),
    UNIQUE INDEX `attendances_date_siteId_manpowerId_key`(`date`, `siteId`, `manpowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower_transfers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challanNo` VARCHAR(191) NOT NULL,
    `challanDate` DATETIME(3) NOT NULL,
    `fromSiteId` INTEGER NOT NULL,
    `toSiteId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `challanCopyUrl` VARCHAR(191) NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manpower_transfers_challanNo_key`(`challanNo`),
    INDEX `manpower_transfers_challanNo_idx`(`challanNo`),
    INDEX `manpower_transfers_fromSiteId_idx`(`fromSiteId`),
    INDEX `manpower_transfers_toSiteId_idx`(`toSiteId`),
    INDEX `manpower_transfers_status_idx`(`status`),
    INDEX `manpower_transfers_challanDate_idx`(`challanDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manpower_transfer_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manpowerTransferId` INTEGER NOT NULL,
    `manpowerId` INTEGER NOT NULL,
    `category` VARCHAR(191) NULL,
    `skillSet` VARCHAR(191) NULL,
    `wage` DECIMAL(12, 2) NULL,
    `minWage` DECIMAL(10, 2) NULL,
    `hours` DECIMAL(5, 2) NULL,
    `esic` DECIMAL(10, 2) NULL,
    `pf` BOOLEAN NOT NULL DEFAULT false,
    `pt` DECIMAL(10, 2) NULL,
    `hra` DECIMAL(10, 2) NULL,
    `mlwf` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `manpower_transfer_items_manpowerTransferId_idx`(`manpowerTransferId`),
    INDEX `manpower_transfer_items_manpowerId_idx`(`manpowerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pay_slips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `manpowerId` INTEGER NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `paySlipDate` DATETIME(3) NOT NULL,
    `govt` BOOLEAN NOT NULL DEFAULT false,
    `netWages` DECIMAL(12, 2) NOT NULL,
    `amountInWords` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pay_slips_period_idx`(`period`),
    INDEX `pay_slips_govt_idx`(`govt`),
    UNIQUE INDEX `pay_slips_manpowerId_period_govt_key`(`manpowerId`, `period`, `govt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pay_slip_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paySlipId` INTEGER NOT NULL,
    `siteId` INTEGER NOT NULL,
    `workingDays` DECIMAL(6, 2) NOT NULL,
    `ot` DECIMAL(6, 2) NULL,
    `idle` DECIMAL(6, 2) NULL,
    `wages` DECIMAL(12, 2) NOT NULL,
    `grossWages` DECIMAL(12, 2) NOT NULL,
    `hra` DECIMAL(12, 2) NULL,
    `pf` DECIMAL(12, 2) NULL,
    `esic` DECIMAL(12, 2) NULL,
    `pt` DECIMAL(12, 2) NULL,
    `mlwf` DECIMAL(12, 2) NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `amountInWords` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pay_slip_details_paySlipId_idx`(`paySlipId`),
    INDEX `pay_slip_details_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_config` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `hoursPerDay` DECIMAL(6, 2) NOT NULL DEFAULT 8,
    `govtWorkingDayCap` INTEGER NOT NULL DEFAULT 26,
    `hraPercentage` DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
    `pfPercentage` DECIMAL(6, 2) NOT NULL DEFAULT 12.00,
    `esicPercentage` DECIMAL(6, 2) NOT NULL DEFAULT 1.75,
    `ptThreshold1` DECIMAL(12, 2) NOT NULL DEFAULT 7500,
    `ptAmount1` DECIMAL(12, 2) NOT NULL DEFAULT 175,
    `ptThreshold2` DECIMAL(12, 2) NOT NULL DEFAULT 10000,
    `ptAmount2` DECIMAL(12, 2) NOT NULL DEFAULT 200,
    `febPtAmount` DECIMAL(12, 2) NOT NULL DEFAULT 300,
    `mlwfAmount` DECIMAL(12, 2) NOT NULL DEFAULT 12,
    `mlwfMonths` VARCHAR(191) NOT NULL DEFAULT '02,06',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_progresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `siteId` INTEGER NOT NULL,
    `boqId` INTEGER NOT NULL,
    `progressDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `daily_progresses_siteId_idx`(`siteId`),
    INDEX `daily_progresses_boqId_idx`(`boqId`),
    INDEX `daily_progresses_createdById_idx`(`createdById`),
    INDEX `daily_progresses_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_progress_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dailyProgressId` INTEGER NOT NULL,
    `boqItemId` INTEGER NOT NULL,
    `clientSerialNo` VARCHAR(191) NULL,
    `activityId` VARCHAR(191) NULL,
    `particulars` VARCHAR(191) NULL,
    `doneQty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    INDEX `daily_progress_details_dailyProgressId_idx`(`dailyProgressId`),
    INDEX `daily_progress_details_boqItemId_idx`(`boqItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_progress_hindrances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dailyProgressId` INTEGER NOT NULL,
    `from` DATETIME(3) NULL,
    `to` DATETIME(3) NULL,
    `hrs` INTEGER NULL,
    `location` VARCHAR(500) NULL,
    `reason` VARCHAR(500) NULL,

    INDEX `daily_progress_hindrances_dailyProgressId_idx`(`dailyProgressId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reportingSiteId_fkey` FOREIGN KEY (`reportingSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting1Id_fkey` FOREIGN KEY (`reporting1Id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reporting2Id_fkey` FOREIGN KEY (`reporting2Id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_categories` ADD CONSTRAINT `asset_categories_assetGroupId_fkey` FOREIGN KEY (`assetGroupId`) REFERENCES `asset_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_currentSiteId_fkey` FOREIGN KEY (`currentSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assetGroupId_fkey` FOREIGN KEY (`assetGroupId`) REFERENCES `asset_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assetCategoryId_fkey` FOREIGN KEY (`assetCategoryId`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_itemCategoryId_fkey` FOREIGN KEY (`itemCategoryId`) REFERENCES `item_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_addresses` ADD CONSTRAINT `billing_addresses_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_addresses` ADD CONSTRAINT `billing_addresses_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `states`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `cities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_item_categories` ADD CONSTRAINT `vendor_item_categories_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_item_categories` ADD CONSTRAINT `vendor_item_categories_itemCategoryId_fkey` FOREIGN KEY (`itemCategoryId`) REFERENCES `item_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boqs` ADD CONSTRAINT `boqs_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_items` ADD CONSTRAINT `boq_items_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_items` ADD CONSTRAINT `boq_items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_targets` ADD CONSTRAINT `boq_targets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boq_targets` ADD CONSTRAINT `boq_targets_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower` ADD CONSTRAINT `manpower_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `manpower_suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower` ADD CONSTRAINT `manpower_currentSiteId_fkey` FOREIGN KEY (`currentSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minimum_wages` ADD CONSTRAINT `minimum_wages_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minimum_wages` ADD CONSTRAINT `minimum_wages_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `minimum_wages` ADD CONSTRAINT `minimum_wages_skillSetId_fkey` FOREIGN KEY (`skillSetId`) REFERENCES `skill_sets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budgets` ADD CONSTRAINT `cashbook_budgets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budget_items` ADD CONSTRAINT `cashbook_budget_items_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `cashbook_budgets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_budget_items` ADD CONSTRAINT `cashbook_budget_items_cashbookHeadId_fkey` FOREIGN KEY (`cashbookHeadId`) REFERENCES `cashbook_heads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_approved1ById_fkey` FOREIGN KEY (`approved1ById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_approved2ById_fkey` FOREIGN KEY (`approved2ById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indents` ADD CONSTRAINT `indents_suspendedById_fkey` FOREIGN KEY (`suspendedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_indentId_fkey` FOREIGN KEY (`indentId`) REFERENCES `indents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indent_items` ADD CONSTRAINT `indent_items_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_budgets` ADD CONSTRAINT `site_budgets_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_budgets` ADD CONSTRAINT `site_budgets_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_rentalCategoryId_fkey` FOREIGN KEY (`rentalCategoryId`) REFERENCES `rental_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rents` ADD CONSTRAINT `rents_rentTypeId_fkey` FOREIGN KEY (`rentTypeId`) REFERENCES `rent_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbooks` ADD CONSTRAINT `cashbooks_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbooks` ADD CONSTRAINT `cashbooks_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_details` ADD CONSTRAINT `cashbook_details_cashbookId_fkey` FOREIGN KEY (`cashbookId`) REFERENCES `cashbooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbook_details` ADD CONSTRAINT `cashbook_details_cashbookHeadId_fkey` FOREIGN KEY (`cashbookHeadId`) REFERENCES `cashbook_heads`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `asset_transfers_fromSiteId_fkey` FOREIGN KEY (`fromSiteId`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `asset_transfers_toSiteId_fkey` FOREIGN KEY (`toSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfers` ADD CONSTRAINT `asset_transfers_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfer_items` ADD CONSTRAINT `asset_transfer_items_assetTransferId_fkey` FOREIGN KEY (`assetTransferId`) REFERENCES `asset_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_transfer_items` ADD CONSTRAINT `asset_transfer_items_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfers` ADD CONSTRAINT `manpower_transfers_fromSiteId_fkey` FOREIGN KEY (`fromSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfers` ADD CONSTRAINT `manpower_transfers_toSiteId_fkey` FOREIGN KEY (`toSiteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfers` ADD CONSTRAINT `manpower_transfers_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfer_items` ADD CONSTRAINT `manpower_transfer_items_manpowerTransferId_fkey` FOREIGN KEY (`manpowerTransferId`) REFERENCES `manpower_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manpower_transfer_items` ADD CONSTRAINT `manpower_transfer_items_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pay_slips` ADD CONSTRAINT `pay_slips_manpowerId_fkey` FOREIGN KEY (`manpowerId`) REFERENCES `manpower`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pay_slip_details` ADD CONSTRAINT `pay_slip_details_paySlipId_fkey` FOREIGN KEY (`paySlipId`) REFERENCES `pay_slips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pay_slip_details` ADD CONSTRAINT `pay_slip_details_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_boqId_fkey` FOREIGN KEY (`boqId`) REFERENCES `boqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progresses` ADD CONSTRAINT `daily_progresses_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progress_details` ADD CONSTRAINT `daily_progress_details_dailyProgressId_fkey` FOREIGN KEY (`dailyProgressId`) REFERENCES `daily_progresses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progress_details` ADD CONSTRAINT `daily_progress_details_boqItemId_fkey` FOREIGN KEY (`boqItemId`) REFERENCES `boq_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_progress_hindrances` ADD CONSTRAINT `daily_progress_hindrances_dailyProgressId_fkey` FOREIGN KEY (`dailyProgressId`) REFERENCES `daily_progresses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
