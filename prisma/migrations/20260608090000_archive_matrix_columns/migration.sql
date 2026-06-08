ALTER TABLE `matrixcolumn` ADD COLUMN `archivedAt` DATETIME(3) NULL;

CREATE INDEX `matrixcolumn_spaceId_archivedAt_order_idx` ON `matrixcolumn`(`spaceId`, `archivedAt`, `order`);
