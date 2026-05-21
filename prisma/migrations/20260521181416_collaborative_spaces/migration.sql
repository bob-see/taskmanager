-- CreateTable
CREATE TABLE `collaborativespace` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spacemember` (
    `id` VARCHAR(36) NOT NULL,
    `spaceId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'member',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matrixrow` (
    `id` VARCHAR(36) NOT NULL,
    `spaceId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matrixcolumn` (
    `id` VARCHAR(36) NOT NULL,
    `spaceId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `order` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `columnstatusoption` (
    `id` VARCHAR(36) NOT NULL,
    `columnId` VARCHAR(36) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `color` VARCHAR(32) NOT NULL,
    `order` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matrixcell` (
    `id` VARCHAR(36) NOT NULL,
    `rowId` VARCHAR(36) NOT NULL,
    `columnId` VARCHAR(36) NOT NULL,
    `textValue` TEXT NULL,
    `numberValue` DECIMAL(18, 4) NULL,
    `dateValue` DATETIME(3) NULL,
    `booleanValue` BOOLEAN NULL,
    `statusOptionId` VARCHAR(36) NULL,
    `userIdValue` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `spacemember_spaceId_userId_key` ON `spacemember`(`spaceId`, `userId`);

-- CreateIndex
CREATE INDEX `spacemember_spaceId_idx` ON `spacemember`(`spaceId`);

-- CreateIndex
CREATE INDEX `spacemember_userId_idx` ON `spacemember`(`userId`);

-- CreateIndex
CREATE INDEX `matrixrow_spaceId_order_idx` ON `matrixrow`(`spaceId`, `order`);

-- CreateIndex
CREATE INDEX `matrixcolumn_spaceId_order_idx` ON `matrixcolumn`(`spaceId`, `order`);

-- CreateIndex
CREATE INDEX `columnstatusoption_columnId_order_idx` ON `columnstatusoption`(`columnId`, `order`);

-- CreateIndex
CREATE UNIQUE INDEX `matrixcell_rowId_columnId_key` ON `matrixcell`(`rowId`, `columnId`);

-- CreateIndex
CREATE INDEX `matrixcell_columnId_idx` ON `matrixcell`(`columnId`);

-- CreateIndex
CREATE INDEX `matrixcell_statusOptionId_idx` ON `matrixcell`(`statusOptionId`);

-- CreateIndex
CREATE INDEX `matrixcell_userIdValue_idx` ON `matrixcell`(`userIdValue`);

-- AddForeignKey
ALTER TABLE `spacemember` ADD CONSTRAINT `spacemember_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `collaborativespace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spacemember` ADD CONSTRAINT `spacemember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrixrow` ADD CONSTRAINT `matrixrow_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `collaborativespace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrixcolumn` ADD CONSTRAINT `matrixcolumn_spaceId_fkey` FOREIGN KEY (`spaceId`) REFERENCES `collaborativespace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `columnstatusoption` ADD CONSTRAINT `columnstatusoption_columnId_fkey` FOREIGN KEY (`columnId`) REFERENCES `matrixcolumn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrixcell` ADD CONSTRAINT `matrixcell_rowId_fkey` FOREIGN KEY (`rowId`) REFERENCES `matrixrow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrixcell` ADD CONSTRAINT `matrixcell_columnId_fkey` FOREIGN KEY (`columnId`) REFERENCES `matrixcolumn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrixcell` ADD CONSTRAINT `matrixcell_statusOptionId_fkey` FOREIGN KEY (`statusOptionId`) REFERENCES `columnstatusoption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matrixcell` ADD CONSTRAINT `matrixcell_userIdValue_fkey` FOREIGN KEY (`userIdValue`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
