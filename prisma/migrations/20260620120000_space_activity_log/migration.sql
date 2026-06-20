ALTER TABLE `activitylog`
  ADD COLUMN `spaceId` VARCHAR(36) NULL,
  ADD COLUMN `metadata` JSON NULL;

CREATE INDEX `ActivityLog_spaceId_idx` ON `activitylog`(`spaceId`);
