-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "defaultView" TEXT,
    "averageBasis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Profile" ("averageBasis", "createdAt", "defaultView", "id", "name", "order", "updatedAt")
SELECT
    "averageBasis",
    "createdAt",
    "defaultView",
    "id",
    "name",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) - 1,
    "updatedAt"
FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
