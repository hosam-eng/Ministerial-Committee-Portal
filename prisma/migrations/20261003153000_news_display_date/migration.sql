-- RCP-CORR-01: revision-owned editorial News date (calendar date, not publish timestamp).

ALTER TABLE "publishing"."news_revision"
ADD COLUMN "display_date" DATE;

UPDATE "publishing"."news_revision" AS nr
SET "display_date" = COALESCE(
  (
    SELECT (n."published_at" AT TIME ZONE 'UTC')::date
    FROM "publishing"."news" AS n
    WHERE n."live_revision_id" = nr."id"
      AND n."published_at" IS NOT NULL
  ),
  (nr."created_at" AT TIME ZONE 'UTC')::date
);

CREATE INDEX "news_revision_display_date_idx"
ON "publishing"."news_revision" ("display_date");
