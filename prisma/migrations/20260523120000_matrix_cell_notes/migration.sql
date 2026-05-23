-- CreateTable
CREATE TABLE `matrixcellnote` (
    `id` VARCHAR(36) NOT NULL,
    `cellId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `matrixcellnote_cellId_createdAt_idx` ON `matrixcellnote`(`cellId`, `createdAt`);

-- CreateIndex
CREATE INDEX `matrixcellnote_userId_idx` ON `matrixcellnote`(`userId`);

-- AddForeignKey
ALTER TABLE `matrixcellnote` ADD CONSTRAINT `matrixcellnote_cellId_fkey` FOREIGN KEY (`cellId`) REFERENCES `matrixcell`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
