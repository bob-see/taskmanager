-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "completedOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "profileId" TEXT NOT NULL DEFAULT 'default',
    "projectId" TEXT,
    "repeatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "repeatPattern" TEXT,
    "repeatDays" INTEGER,
    "repeatWeeklyDay" INTEGER,
    "repeatMonthlyDay" INTEGER,
    CONSTRAINT "Task_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" (
    "category",
    "completedAt",
    "completedOn",
    "createdAt",
    "dueAt",
    "id",
    "notes",
    "profileId",
    "projectId",
    "startDate",
    "title",
    "updatedAt",
    "repeatEnabled",
    "repeatPattern",
    "repeatDays",
    "repeatWeeklyDay",
    "repeatMonthlyDay"
)
SELECT
    "category",
    "completedAt",
    "completedOn",
    "createdAt",
    "dueAt",
    "id",
    "notes",
    "profileId",
    "projectId",
    "startDate",
    "title",
    "updatedAt",
    "repeatEnabled",
    "repeatPattern",
    CASE
        WHEN "repeatEnabled" = 1 AND lower(coalesce("repeatPattern", '')) = 'daily' THEN 127
        WHEN "repeatEnabled" = 1 AND lower(coalesce("repeatPattern", '')) = 'weekly' AND "repeatWeeklyDay" BETWEEN 1 AND 7 THEN (1 << ("repeatWeeklyDay" - 1))
        ELSE NULL
    END,
    "repeatWeeklyDay",
    "repeatMonthlyDay"
FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_profileId_startDate_idx" ON "Task"("profileId", "startDate");
CREATE INDEX "Task_profileId_dueAt_idx" ON "Task"("profileId", "dueAt");
CREATE INDEX "Task_profileId_completedOn_idx" ON "Task"("profileId", "completedOn");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
