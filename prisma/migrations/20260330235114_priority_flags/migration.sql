-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME,
    "category" TEXT,
    "orderIndex" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "profileId" TEXT NOT NULL,
    CONSTRAINT "Project_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("archived", "category", "collapsed", "createdAt", "dueAt", "id", "name", "orderIndex", "profileId", "startDate", "updatedAt") SELECT "archived", "category", "collapsed", "createdAt", "dueAt", "id", "name", "orderIndex", "profileId", "startDate", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_profileId_createdAt_idx" ON "Project"("profileId", "createdAt");
CREATE INDEX "Project_profileId_orderIndex_idx" ON "Project"("profileId", "orderIndex");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "completedOn" DATETIME,
    "orderIndex" INTEGER,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "profileId" TEXT NOT NULL DEFAULT 'default',
    "projectId" TEXT,
    "recurrenceSeriesId" TEXT,
    "repeatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "repeatPattern" TEXT,
    "repeatDays" INTEGER,
    "repeatWeeklyDay" INTEGER,
    "repeatMonthlyDay" INTEGER,
    CONSTRAINT "Task_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("category", "completedAt", "completedOn", "createdAt", "dueAt", "id", "notes", "orderIndex", "profileId", "projectId", "recurrenceSeriesId", "repeatDays", "repeatEnabled", "repeatMonthlyDay", "repeatPattern", "repeatWeeklyDay", "startDate", "title", "updatedAt") SELECT "category", "completedAt", "completedOn", "createdAt", "dueAt", "id", "notes", "orderIndex", "profileId", "projectId", "recurrenceSeriesId", "repeatDays", "repeatEnabled", "repeatMonthlyDay", "repeatPattern", "repeatWeeklyDay", "startDate", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_profileId_startDate_idx" ON "Task"("profileId", "startDate");
CREATE INDEX "Task_profileId_dueAt_idx" ON "Task"("profileId", "dueAt");
CREATE INDEX "Task_profileId_completedOn_idx" ON "Task"("profileId", "completedOn");
CREATE INDEX "Task_profileId_completedOn_orderIndex_idx" ON "Task"("profileId", "completedOn", "orderIndex");
CREATE INDEX "Task_profileId_recurrenceSeriesId_idx" ON "Task"("profileId", "recurrenceSeriesId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE UNIQUE INDEX "Task_profileId_recurrenceSeriesId_startDate_key" ON "Task"("profileId", "recurrenceSeriesId", "startDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
