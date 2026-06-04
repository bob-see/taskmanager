-- CreateTable
CREATE TABLE `tasknote` (
    `id` VARCHAR(36) NOT NULL,
    `taskId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill legacy task notes into append-only note history.
-- Task.notes is intentionally preserved and not modified.
INSERT INTO `tasknote` (`id`, `taskId`, `userId`, `content`, `createdAt`)
SELECT
    UUID(),
    `task`.`id`,
    NULL,
    `task`.`notes`,
    COALESCE(`task`.`updatedAt`, `task`.`createdAt`, CURRENT_TIMESTAMP(3))
FROM `task`
WHERE `task`.`notes` IS NOT NULL
  AND LENGTH(TRIM(`task`.`notes`)) > 0;

-- CreateIndex
CREATE INDEX `tasknote_taskId_createdAt_idx` ON `tasknote`(`taskId`, `createdAt`);

-- CreateIndex
CREATE INDEX `tasknote_userId_idx` ON `tasknote`(`userId`);
