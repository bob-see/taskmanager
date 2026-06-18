ALTER TABLE `task`
  ADD COLUMN `repeatPaused` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `repeatPauseUntil` DATETIME NULL,
  ADD COLUMN `repeatPauseNote` TEXT NULL;
