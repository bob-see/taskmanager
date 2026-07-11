-- AlterTable
ALTER TABLE `user` ADD COLUMN `notificationPushEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `notification` ADD COLUMN `clearedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `notificationpreference` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `notificationType` ENUM('SYSTEM', 'GENERAL', 'DELEGATED_TASK_RECEIVED', 'DELEGATED_TASK_ACCEPTED', 'DELEGATED_TASK_DECLINED', 'DELEGATED_TASK_NOTE_ADDED', 'DELEGATED_TASK_COMPLETED', 'DELEGATED_TASK_CLOSED') NOT NULL,
    `inAppEnabled` BOOLEAN NOT NULL DEFAULT true,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notificationpreference_userId_notificationType_key`(`userId`, `notificationType`),
    INDEX `notificationpreference_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `notification_recipientUserId_clearedAt_createdAt_idx` ON `notification`(`recipientUserId`, `clearedAt`, `createdAt`);
