-- Preserve an archived user's history while preventing future authentication.
ALTER TABLE `user` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- Preserve open delegated work for audit and closure by its original delegator.
ALTER TABLE `delegatedtask` MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'DECLINED', 'USER_ARCHIVED') NOT NULL DEFAULT 'PENDING';
