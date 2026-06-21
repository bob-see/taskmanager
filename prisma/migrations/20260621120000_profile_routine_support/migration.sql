ALTER TABLE `profile`
  ADD COLUMN `routineSupportEnabled` BOOLEAN NOT NULL DEFAULT false;

UPDATE `profile` AS p
INNER JOIN `user` AS u ON u.`id` = p.`userId`
SET p.`routineSupportEnabled` = true
WHERE LOWER(TRIM(u.`name`)) = 'evie'
  AND LOWER(TRIM(p.`name`)) = 'personal';
