-- CreateTable
CREATE TABLE `delegatedtask` (
    `id` VARCHAR(36) NOT NULL,
    `taskId` VARCHAR(36) NOT NULL,
    `assignedByUserId` VARCHAR(36) NULL,
    `assignedToUserId` VARCHAR(36) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `respondedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `delegatedtask_taskId_key`(`taskId`),
    INDEX `delegatedtask_assignedByUserId_idx`(`assignedByUserId`),
    INDEX `delegatedtask_assignedToUserId_idx`(`assignedToUserId`),
    INDEX `delegatedtask_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `delegatedtask` ADD CONSTRAINT `delegatedtask_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delegatedtask` ADD CONSTRAINT `delegatedtask_assignedByUserId_fkey` FOREIGN KEY (`assignedByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delegatedtask` ADD CONSTRAINT `delegatedtask_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
