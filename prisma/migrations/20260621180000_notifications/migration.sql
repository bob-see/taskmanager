-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(36) NOT NULL,
    `recipientUserId` VARCHAR(36) NOT NULL,
    `actorUserId` VARCHAR(36) NULL,
    `type` ENUM('SYSTEM', 'GENERAL', 'DELEGATED_TASK_RECEIVED', 'DELEGATED_TASK_ACCEPTED', 'DELEGATED_TASK_DECLINED', 'DELEGATED_TASK_NOTE_ADDED', 'DELEGATED_TASK_COMPLETED', 'DELEGATED_TASK_CLOSED') NOT NULL DEFAULT 'GENERAL',
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `targetUrl` VARCHAR(512) NOT NULL,
    `metadata` JSON NULL,
    `eventKey` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notification_eventKey_key`(`eventKey`),
    INDEX `notification_recipientUserId_readAt_createdAt_idx`(`recipientUserId`, `readAt`, `createdAt`),
    INDEX `notification_recipientUserId_createdAt_idx`(`recipientUserId`, `createdAt`),
    INDEX `notification_actorUserId_idx`(`actorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
