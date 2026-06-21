CREATE TABLE `sundaycheckin` (
  `id` VARCHAR(36) NOT NULL,
  `profileId` VARCHAR(36) NOT NULL,
  `weekStart` DATETIME(3) NOT NULL,
  `selectedOptions` JSON NOT NULL,
  `reflection` TEXT NULL,
  `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `sundaycheckin_profileId_weekStart_key`(`profileId`, `weekStart`),
  INDEX `sundaycheckin_profileId_completedAt_idx`(`profileId`, `completedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
