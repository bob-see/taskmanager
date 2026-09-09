-- AlterTable
ALTER TABLE `user` ADD COLUMN `wfhDefaultDays` JSON NULL;

-- CreateTable
CREATE TABLE `worklocationday` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `isWfh` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `worklocationday_userId_date_key`(`userId`, `date`),
    INDEX `worklocationday_userId_date_idx`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
