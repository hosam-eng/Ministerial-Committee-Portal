-- IMP-13 Managed Pages: stable aggregate, revisions, shared blocks, references.

-- CreateEnum
CREATE TYPE "publishing"."ManagedPagePublicationStatus" AS ENUM ('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "publishing"."ManagedPageWorkflowStatus" AS ENUM ('EDITING', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "publishing"."ManagedPageWorkflowAction" AS ENUM ('SUBMIT', 'RETURN', 'APPROVE', 'RESTORE');

-- CreateEnum
CREATE TYPE "publishing"."ManagedPagePublicationAction" AS ENUM ('PUBLISH', 'UNPUBLISH');

-- CreateEnum
CREATE TYPE "publishing"."ManagedPageBlockType" AS ENUM ('RICHTEXT', 'CALLOUT', 'LINK_LIST');

-- CreateEnum
CREATE TYPE "publishing"."ManagedPageCalloutVariant" AS ENUM ('INSTITUTIONAL', 'INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "publishing"."ManagedPageReferenceOrigin" AS ENUM ('RICHTEXT', 'LINK_LIST');

-- CreateTable
CREATE TABLE "publishing"."managed_page" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "system_key" TEXT,
    "publication_status" "publishing"."ManagedPagePublicationStatus" NOT NULL DEFAULT 'NEVER_PUBLISHED',
    "live_revision_id" UUID,
    "active_revision_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "unpublished_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "managed_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_revision" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "managed_page_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "workflow_status" "publishing"."ManagedPageWorkflowStatus" NOT NULL DEFAULT 'EDITING',
    "edit_version" INTEGER NOT NULL DEFAULT 0,
    "based_on_revision_id" UUID,
    "created_by_id" UUID,
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "managed_page_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_revision_translation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "intro" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "managed_page_revision_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_revision_block" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "block_type" "publishing"."ManagedPageBlockType" NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "callout_variant" "publishing"."ManagedPageCalloutVariant",
    "link_items" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_page_revision_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_revision_block_translation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "block_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "managed_page_revision_block_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_reference" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source_revision_id" UUID NOT NULL,
    "source_block_id" UUID NOT NULL,
    "target_page_id" UUID NOT NULL,
    "locale" TEXT,
    "origin" "publishing"."ManagedPageReferenceOrigin" NOT NULL,
    "item_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_page_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_slug_redirect" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "managed_page_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_page_slug_redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_workflow_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "managed_page_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "publishing"."ManagedPageWorkflowAction" NOT NULL,
    "from_status" "publishing"."ManagedPageWorkflowStatus" NOT NULL,
    "to_status" "publishing"."ManagedPageWorkflowStatus" NOT NULL,
    "comment" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_page_workflow_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing"."managed_page_publication_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "managed_page_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "publishing"."ManagedPagePublicationAction" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_page_publication_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_system_key_key" ON "publishing"."managed_page"("system_key");

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_active_revision_id_key" ON "publishing"."managed_page"("active_revision_id");

-- CreateIndex
CREATE INDEX "managed_page_revision_managed_page_id_idx" ON "publishing"."managed_page_revision"("managed_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_revision_managed_page_id_revision_number_key" ON "publishing"."managed_page_revision"("managed_page_id", "revision_number");

-- CreateIndex
CREATE INDEX "managed_page_revision_translation_locale_slug_idx" ON "publishing"."managed_page_revision_translation"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_revision_translation_revision_id_locale_key" ON "publishing"."managed_page_revision_translation"("revision_id", "locale");

-- CreateIndex
CREATE INDEX "managed_page_revision_block_revision_id_idx" ON "publishing"."managed_page_revision_block"("revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_revision_block_revision_id_position_key" ON "publishing"."managed_page_revision_block"("revision_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_revision_block_translation_block_id_locale_key" ON "publishing"."managed_page_revision_block_translation"("block_id", "locale");

-- CreateIndex
CREATE INDEX "managed_page_reference_source_revision_id_idx" ON "publishing"."managed_page_reference"("source_revision_id");

-- CreateIndex
CREATE INDEX "managed_page_reference_target_page_id_idx" ON "publishing"."managed_page_reference"("target_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "managed_page_slug_redirect_locale_slug_key" ON "publishing"."managed_page_slug_redirect"("locale", "slug");

-- CreateIndex
CREATE INDEX "managed_page_workflow_event_managed_page_id_idx" ON "publishing"."managed_page_workflow_event"("managed_page_id");

-- CreateIndex
CREATE INDEX "managed_page_publication_event_managed_page_id_idx" ON "publishing"."managed_page_publication_event"("managed_page_id");

-- AddForeignKey
ALTER TABLE "publishing"."managed_page" ADD CONSTRAINT "managed_page_live_revision_id_fkey" FOREIGN KEY ("live_revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page" ADD CONSTRAINT "managed_page_active_revision_id_fkey" FOREIGN KEY ("active_revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_revision" ADD CONSTRAINT "managed_page_revision_managed_page_id_fkey" FOREIGN KEY ("managed_page_id") REFERENCES "publishing"."managed_page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_revision" ADD CONSTRAINT "managed_page_revision_based_on_revision_id_fkey" FOREIGN KEY ("based_on_revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_revision_translation" ADD CONSTRAINT "managed_page_revision_translation_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_revision_block" ADD CONSTRAINT "managed_page_revision_block_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_revision_block_translation" ADD CONSTRAINT "managed_page_revision_block_translation_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "publishing"."managed_page_revision_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_reference" ADD CONSTRAINT "managed_page_reference_source_revision_id_fkey" FOREIGN KEY ("source_revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_reference" ADD CONSTRAINT "managed_page_reference_source_block_id_fkey" FOREIGN KEY ("source_block_id") REFERENCES "publishing"."managed_page_revision_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_reference" ADD CONSTRAINT "managed_page_reference_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "publishing"."managed_page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_slug_redirect" ADD CONSTRAINT "managed_page_slug_redirect_managed_page_id_fkey" FOREIGN KEY ("managed_page_id") REFERENCES "publishing"."managed_page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_workflow_event" ADD CONSTRAINT "managed_page_workflow_event_managed_page_id_fkey" FOREIGN KEY ("managed_page_id") REFERENCES "publishing"."managed_page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_workflow_event" ADD CONSTRAINT "managed_page_workflow_event_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_publication_event" ADD CONSTRAINT "managed_page_publication_event_managed_page_id_fkey" FOREIGN KEY ("managed_page_id") REFERENCES "publishing"."managed_page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing"."managed_page_publication_event" ADD CONSTRAINT "managed_page_publication_event_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "publishing"."managed_page_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publishing"."managed_page_revision"
  ADD CONSTRAINT "managed_page_revision_number_ck" CHECK ("revision_number" >= 1),
  ADD CONSTRAINT "managed_page_revision_edit_version_ck" CHECK ("edit_version" >= 0);

ALTER TABLE "publishing"."managed_page_revision_block"
  ADD CONSTRAINT "managed_page_revision_block_position_ck" CHECK ("position" >= 0),
  ADD CONSTRAINT "managed_page_revision_block_shape_ck" CHECK (
    ("block_type" = 'RICHTEXT' AND "callout_variant" IS NULL AND "link_items" IS NULL)
    OR ("block_type" = 'CALLOUT' AND "callout_variant" IS NOT NULL AND "link_items" IS NULL)
    OR ("block_type" = 'LINK_LIST' AND "callout_variant" IS NULL AND "link_items" IS NOT NULL)
  );

INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'managed_pages.pages.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'managed_pages.pages.create', CURRENT_TIMESTAMP),
    (uuidv7(), 'managed_pages.pages.edit', CURRENT_TIMESTAMP),
    (uuidv7(), 'managed_pages.pages.review', CURRENT_TIMESTAMP),
    (uuidv7(), 'managed_pages.pages.publish', CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator' AND p."key" IN (
    'managed_pages.pages.read',
    'managed_pages.pages.create',
    'managed_pages.pages.edit',
    'managed_pages.pages.review',
    'managed_pages.pages.publish'
);
