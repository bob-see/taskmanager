-- AlterTable
ALTER TABLE `user` ADD COLUMN `dailyTaskDigestSettings` JSON NULL;

-- AlterTable
ALTER TABLE `notificationpreference` MODIFY `notificationType` ENUM('SYSTEM', 'GENERAL', 'DELEGATED_TASK_RECEIVED', 'DELEGATED_TASK_ACCEPTED', 'DELEGATED_TASK_DECLINED', 'DELEGATED_TASK_NOTE_ADDED', 'DELEGATED_TASK_COMPLETED', 'DELEGATED_TASK_CLOSED', 'DAILY_TASK_DIGEST') NOT NULL;

-- CreateTable
CREATE TABLE `dailytaskdigest` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `digestDate` DATE NOT NULL,
    `claimedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dailytaskdigest_userId_digestDate_key`(`userId`, `digestDate`),
    INDEX `dailytaskdigest_deliveredAt_claimedAt_idx`(`deliveredAt`, `claimedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
