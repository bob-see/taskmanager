-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `profileId` VARCHAR(36) NULL,
    `taskId` VARCHAR(36) NULL,
    `projectId` VARCHAR(36) NULL,
    `timeEntryId` VARCHAR(36) NULL,
    `type` VARCHAR(64) NOT NULL,
    `description` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ActivityLog_userId_createdAt_idx` ON `ActivityLog`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `ActivityLog_type_idx` ON `ActivityLog`(`type`);

-- CreateIndex
CREATE INDEX `ActivityLog_profileId_idx` ON `ActivityLog`(`profileId`);

-- CreateIndex
CREATE INDEX `ActivityLog_taskId_idx` ON `ActivityLog`(`taskId`);

-- CreateIndex
CREATE INDEX `ActivityLog_projectId_idx` ON `ActivityLog`(`projectId`);

-- CreateIndex
CREATE INDEX `ActivityLog_timeEntryId_idx` ON `ActivityLog`(`timeEntryId`);
