-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMinutes" INTEGER,
    "loggedMinutes" INTEGER,
    "roundingMode" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TimeEntry_profileId_entryDate_idx" ON "TimeEntry"("profileId", "entryDate");

-- CreateIndex
CREATE INDEX "TimeEntry_entryDate_idx" ON "TimeEntry"("entryDate");

-- CreateIndex
CREATE INDEX "TimeEntry_endTime_idx" ON "TimeEntry"("endTime");
