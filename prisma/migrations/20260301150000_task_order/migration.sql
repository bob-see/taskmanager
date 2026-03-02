ALTER TABLE "Task" ADD COLUMN "orderIndex" INTEGER;

CREATE INDEX "Task_profileId_completedOn_orderIndex_idx"
ON "Task"("profileId", "completedOn", "orderIndex");

WITH ranked_tasks AS (
  SELECT
    "id",
    (
      ROW_NUMBER() OVER (
        PARTITION BY "profileId"
        ORDER BY
          CASE WHEN "completedOn" IS NULL THEN 0 ELSE 1 END ASC,
          "startDate" ASC,
          "createdAt" ASC,
          "id" ASC
      )
    ) * 10 AS next_order_index
  FROM "Task"
)
UPDATE "Task"
SET "orderIndex" = (
  SELECT ranked_tasks.next_order_index
  FROM ranked_tasks
  WHERE ranked_tasks."id" = "Task"."id"
);
