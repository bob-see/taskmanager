-- AlterTable
ALTER TABLE `task` ADD COLUMN `workflowRunId` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `workflow` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `workflow_userId_status_updatedAt_idx`(`userId`, `status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflowtask` (
    `id` VARCHAR(36) NOT NULL,
    `workflowId` VARCHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `startOffsetDays` INTEGER NOT NULL DEFAULT 0,
    `dueRule` VARCHAR(32) NOT NULL DEFAULT 'NONE',
    `dueOffsetDays` INTEGER NULL,
    `isPriority` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workflowtask_workflowId_position_key`(`workflowId`, `position`),
    INDEX `workflowtask_workflowId_idx`(`workflowId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflowrun` (
    `id` VARCHAR(36) NOT NULL,
    `workflowId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `profileId` VARCHAR(36) NOT NULL,
    `launchName` VARCHAR(191) NOT NULL,
    `workflowNameSnapshot` VARCHAR(191) NOT NULL,
    `categorySnapshot` VARCHAR(191) NULL,
    `workflowDate` DATETIME(3) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdTaskCount` INTEGER NOT NULL,
    `launchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workflowrun_userId_idempotencyKey_key`(`userId`, `idempotencyKey`),
    INDEX `workflowrun_userId_profileId_completedAt_launchedAt_idx`(`userId`, `profileId`, `completedAt`, `launchedAt`),
    INDEX `workflowrun_workflowId_launchedAt_idx`(`workflowId`, `launchedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `task_workflowRunId_idx` ON `task`(`workflowRunId`);
