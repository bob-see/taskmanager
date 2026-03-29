ALTER TABLE "Project" ADD COLUMN "orderIndex" INTEGER;

CREATE INDEX "Project_profileId_orderIndex_idx"
ON "Project"("profileId", "orderIndex");

WITH ranked_projects AS (
  SELECT
    "id",
    (
      ROW_NUMBER() OVER (
        PARTITION BY "profileId"
        ORDER BY "createdAt" ASC, "id" ASC
      )
    ) * 10 AS next_order_index
  FROM "Project"
)
UPDATE "Project"
SET "orderIndex" = (
  SELECT ranked_projects.next_order_index
  FROM ranked_projects
  WHERE ranked_projects."id" = "Project"."id"
);
