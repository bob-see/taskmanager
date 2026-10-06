-- Remember when each profile's task list was last opened so newly created
-- tasks can be surfaced in the sidebar until they have been seen.
ALTER TABLE `profile`
  ADD COLUMN `taskBadgeLastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
