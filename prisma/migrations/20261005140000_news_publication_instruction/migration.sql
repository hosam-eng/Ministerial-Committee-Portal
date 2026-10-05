-- CreateEnum
CREATE TYPE "publishing"."NewsPublicationInstructionStatus" AS ENUM (
  'SCHEDULED',
  'CANCELLED',
  'EXECUTED',
  'INELIGIBLE'
);

-- CreateTable
CREATE TABLE "publishing"."news_publication_instruction" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "news_id" UUID NOT NULL,
  "revision_id" UUID NOT NULL,
  "publish_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "publishing"."NewsPublicationInstructionStatus" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancelled_by_id" UUID,
  "executed_at" TIMESTAMPTZ(6),
  "ineligible_at" TIMESTAMPTZ(6),
  "ineligible_reason" TEXT,

  CONSTRAINT "news_publication_instruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_publication_instruction_news_id_idx"
  ON "publishing"."news_publication_instruction"("news_id");

CREATE INDEX "news_publication_instruction_status_publish_at_idx"
  ON "publishing"."news_publication_instruction"("status", "publish_at");

CREATE UNIQUE INDEX "news_publication_instruction_one_scheduled_per_news_idx"
  ON "publishing"."news_publication_instruction"("news_id")
  WHERE "status" = 'SCHEDULED';

-- AddForeignKey
ALTER TABLE "publishing"."news_publication_instruction"
  ADD CONSTRAINT "news_publication_instruction_news_id_fkey"
  FOREIGN KEY ("news_id") REFERENCES "publishing"."news"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publishing"."news_publication_instruction"
  ADD CONSTRAINT "news_publication_instruction_revision_id_fkey"
  FOREIGN KEY ("revision_id") REFERENCES "publishing"."news_revision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
