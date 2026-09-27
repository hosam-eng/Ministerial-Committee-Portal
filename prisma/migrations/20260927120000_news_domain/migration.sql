-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "publishing";

-- CreateEnum
CREATE TYPE "publishing"."NewsPublicationStatus" AS ENUM ('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "publishing"."NewsWorkflowStatus" AS ENUM ('EDITING', 'PENDING_REVIEW', 'APPROVED', 'READY', 'RETURNED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "publishing"."NewsWorkflowAction" AS ENUM ('SUBMIT', 'RETURN', 'APPROVE', 'MARK_READY', 'ABANDON');

-- CreateEnum
CREATE TYPE "publishing"."NewsPublicationAction" AS ENUM ('PUBLISH', 'UNPUBLISH');

-- CreateTable
CREATE TABLE "publishing"."news" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "publication_status" "publishing"."NewsPublicationStatus" NOT NULL DEFAULT 'NEVER_PUBLISHED',
    "live_revision_id" UUID,
    "active_revision_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "unpublished_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."news_revision" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "news_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "workflow_status" "publishing"."NewsWorkflowStatus" NOT NULL DEFAULT 'EDITING',
    "edit_version" INTEGER NOT NULL DEFAULT 0,
    "based_on_revision_id" UUID,
    "created_by_id" UUID,
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."news_revision_translation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "body" JSONB,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_revision_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."news_category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."news_revision_category" (
    "revision_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_revision_category_pkey" PRIMARY KEY ("revision_id","category_id")
);

-- CreateTable
CREATE TABLE "publishing"."news_slug_redirect" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "news_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_slug_redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."news_workflow_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "news_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "publishing"."NewsWorkflowAction" NOT NULL,
    "from_status" "publishing"."NewsWorkflowStatus" NOT NULL,
    "to_status" "publishing"."NewsWorkflowStatus" NOT NULL,
    "comment" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_workflow_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."news_publication_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "news_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "publishing"."NewsPublicationAction" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_publication_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_active_revision_id_key" ON "publishing"."news"("active_revision_id");

-- CreateIndex
CREATE INDEX "news_revision_news_id_idx" ON "publishing"."news_revision"("news_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_revision_news_id_revision_number_key" ON "publishing"."news_revision"("news_id", "revision_number");

-- CreateIndex
CREATE INDEX "news_revision_translation_locale_slug_idx" ON "publishing"."news_revision_translation"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_revision_translation_revision_id_locale_key" ON "publishing"."news_revision_translation"("revision_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_redirect_locale_slug_key" ON "publishing"."news_slug_redirect"("locale", "slug");

-- CreateIndex
CREATE INDEX "news_workflow_event_news_id_idx" ON "publishing"."news_workflow_event"("news_id");

-- CreateIndex
CREATE INDEX "news_publication_event_news_id_idx" ON "publishing"."news_publication_event"("news_id");

-- AddForeignKey
ALTER TABLE "publishing"."news" ADD CONSTRAINT "news_live_revision_id_fkey" FOREIGN KEY ("live_revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news" ADD CONSTRAINT "news_active_revision_id_fkey" FOREIGN KEY ("active_revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_revision" ADD CONSTRAINT "news_revision_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "publishing"."news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_revision" ADD CONSTRAINT "news_revision_based_on_revision_id_fkey" FOREIGN KEY ("based_on_revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_revision_translation" ADD CONSTRAINT "news_revision_translation_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_revision_category" ADD CONSTRAINT "news_revision_category_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_revision_category" ADD CONSTRAINT "news_revision_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "publishing"."news_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_slug_redirect" ADD CONSTRAINT "news_slug_redirect_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "publishing"."news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_workflow_event" ADD CONSTRAINT "news_workflow_event_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "publishing"."news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_workflow_event" ADD CONSTRAINT "news_workflow_event_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_publication_event" ADD CONSTRAINT "news_publication_event_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "publishing"."news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."news_publication_event" ADD CONSTRAINT "news_publication_event_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."news_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT USAGE ON SCHEMA "publishing" TO mcp_runtime;

INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'publishing.news.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'publishing.news.create', CURRENT_TIMESTAMP),
    (uuidv7(), 'publishing.news.edit', CURRENT_TIMESTAMP),
    (uuidv7(), 'publishing.news.review', CURRENT_TIMESTAMP),
    (uuidv7(), 'publishing.news.publish', CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator' AND p."key" IN (
    'publishing.news.read', 'publishing.news.create', 'publishing.news.edit',
    'publishing.news.review', 'publishing.news.publish'
);
