-- IMP-17 Homepage Management

CREATE SCHEMA IF NOT EXISTS "homepage";

CREATE TYPE "homepage"."HomepagePublicationStatus" AS ENUM ('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED');
CREATE TYPE "homepage"."HomepageWorkflowStatus" AS ENUM ('EDITING', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');
CREATE TYPE "homepage"."HomepageWorkflowAction" AS ENUM ('SUBMIT', 'RETURN', 'APPROVE', 'RESTORE');
CREATE TYPE "homepage"."HomepagePublicationAction" AS ENUM ('PUBLISH', 'UNPUBLISH');
CREATE TYPE "homepage"."HomepageSectionType" AS ENUM ('HERO', 'NEWS');
CREATE TYPE "homepage"."HomepageNewsMode" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "homepage"."HomepageCtaTargetType" AS ENUM ('SYSTEM_ROUTE', 'CONTENT_ROUTE', 'EXTERNAL_LINK');
CREATE TYPE "homepage"."HomepageContentTargetKind" AS ENUM ('MANAGED_PAGE');

CREATE TABLE "homepage"."homepage" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "singleton_key" TEXT NOT NULL,
    "publication_status" "homepage"."HomepagePublicationStatus" NOT NULL DEFAULT 'NEVER_PUBLISHED',
    "live_revision_id" UUID,
    "active_revision_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "unpublished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "homepage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_revision" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "homepage_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "workflow_status" "homepage"."HomepageWorkflowStatus" NOT NULL DEFAULT 'EDITING',
    "edit_version" INTEGER NOT NULL DEFAULT 0,
    "based_on_revision_id" UUID,
    "created_by_id" UUID,
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "homepage_revision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_section" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "section_type" "homepage"."HomepageSectionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_hero_section" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "section_id" UUID NOT NULL,
    "cta_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cta_target_type" "homepage"."HomepageCtaTargetType",
    "system_route_key" TEXT,
    "content_target_kind" "homepage"."HomepageContentTargetKind",
    "content_target_id" UUID,
    "external_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_hero_section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_hero_translation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "hero_section_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "supporting_text" TEXT NOT NULL DEFAULT '',
    "cta_label" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "homepage_hero_translation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_news_section" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "section_id" UUID NOT NULL,
    "mode" "homepage"."HomepageNewsMode" NOT NULL DEFAULT 'AUTOMATIC',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_news_section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_news_translation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "news_section_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "section_heading" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "homepage_news_translation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_news_manual_item" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "news_section_id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_news_manual_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_workflow_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "homepage_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "homepage"."HomepageWorkflowAction" NOT NULL,
    "from_status" "homepage"."HomepageWorkflowStatus" NOT NULL,
    "to_status" "homepage"."HomepageWorkflowStatus" NOT NULL,
    "comment" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_workflow_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homepage"."homepage_publication_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "homepage_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "homepage"."HomepagePublicationAction" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homepage_publication_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "homepage_singleton_key_key" ON "homepage"."homepage"("singleton_key");
CREATE UNIQUE INDEX "homepage_active_revision_id_key" ON "homepage"."homepage"("active_revision_id");
CREATE UNIQUE INDEX "homepage_revision_homepage_id_revision_number_key" ON "homepage"."homepage_revision"("homepage_id", "revision_number");
CREATE UNIQUE INDEX "homepage_section_revision_id_section_type_key" ON "homepage"."homepage_section"("revision_id", "section_type");
CREATE UNIQUE INDEX "homepage_section_revision_id_position_key" ON "homepage"."homepage_section"("revision_id", "position");
CREATE UNIQUE INDEX "homepage_hero_section_section_id_key" ON "homepage"."homepage_hero_section"("section_id");
CREATE UNIQUE INDEX "homepage_hero_translation_hero_section_id_locale_key" ON "homepage"."homepage_hero_translation"("hero_section_id", "locale");
CREATE UNIQUE INDEX "homepage_news_section_section_id_key" ON "homepage"."homepage_news_section"("section_id");
CREATE UNIQUE INDEX "homepage_news_translation_news_section_id_locale_key" ON "homepage"."homepage_news_translation"("news_section_id", "locale");
CREATE UNIQUE INDEX "homepage_news_manual_item_news_section_id_news_id_key" ON "homepage"."homepage_news_manual_item"("news_section_id", "news_id");
CREATE UNIQUE INDEX "homepage_news_manual_item_news_section_id_position_key" ON "homepage"."homepage_news_manual_item"("news_section_id", "position");
CREATE INDEX "homepage_revision_homepage_id_idx" ON "homepage"."homepage_revision"("homepage_id");
CREATE INDEX "homepage_section_revision_id_idx" ON "homepage"."homepage_section"("revision_id");
CREATE INDEX "homepage_news_manual_item_news_id_idx" ON "homepage"."homepage_news_manual_item"("news_id");
CREATE INDEX "homepage_workflow_event_homepage_id_idx" ON "homepage"."homepage_workflow_event"("homepage_id");
CREATE INDEX "homepage_publication_event_homepage_id_idx" ON "homepage"."homepage_publication_event"("homepage_id");

ALTER TABLE "homepage"."homepage"
    ADD CONSTRAINT "homepage_live_revision_id_fkey"
    FOREIGN KEY ("live_revision_id") REFERENCES "homepage"."homepage_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage"
    ADD CONSTRAINT "homepage_active_revision_id_fkey"
    FOREIGN KEY ("active_revision_id") REFERENCES "homepage"."homepage_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_revision"
    ADD CONSTRAINT "homepage_revision_homepage_id_fkey"
    FOREIGN KEY ("homepage_id") REFERENCES "homepage"."homepage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_revision"
    ADD CONSTRAINT "homepage_revision_based_on_revision_id_fkey"
    FOREIGN KEY ("based_on_revision_id") REFERENCES "homepage"."homepage_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_section"
    ADD CONSTRAINT "homepage_section_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "homepage"."homepage_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_hero_section"
    ADD CONSTRAINT "homepage_hero_section_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "homepage"."homepage_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_hero_translation"
    ADD CONSTRAINT "homepage_hero_translation_hero_section_id_fkey"
    FOREIGN KEY ("hero_section_id") REFERENCES "homepage"."homepage_hero_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_news_section"
    ADD CONSTRAINT "homepage_news_section_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "homepage"."homepage_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_news_translation"
    ADD CONSTRAINT "homepage_news_translation_news_section_id_fkey"
    FOREIGN KEY ("news_section_id") REFERENCES "homepage"."homepage_news_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_news_manual_item"
    ADD CONSTRAINT "homepage_news_manual_item_news_section_id_fkey"
    FOREIGN KEY ("news_section_id") REFERENCES "homepage"."homepage_news_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_workflow_event"
    ADD CONSTRAINT "homepage_workflow_event_homepage_id_fkey"
    FOREIGN KEY ("homepage_id") REFERENCES "homepage"."homepage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_workflow_event"
    ADD CONSTRAINT "homepage_workflow_event_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "homepage"."homepage_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_publication_event"
    ADD CONSTRAINT "homepage_publication_event_homepage_id_fkey"
    FOREIGN KEY ("homepage_id") REFERENCES "homepage"."homepage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_publication_event"
    ADD CONSTRAINT "homepage_publication_event_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "homepage"."homepage_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "homepage"."homepage_revision"
    ADD CONSTRAINT "homepage_revision_number_ck" CHECK ("revision_number" >= 1),
    ADD CONSTRAINT "homepage_revision_edit_version_ck" CHECK ("edit_version" >= 0);

ALTER TABLE "homepage"."homepage_section"
    ADD CONSTRAINT "homepage_section_position_ck" CHECK ("position" >= 0);

ALTER TABLE "homepage"."homepage_news_manual_item"
    ADD CONSTRAINT "homepage_news_manual_item_position_ck" CHECK ("position" >= 0);

INSERT INTO "homepage"."homepage" ("id", "singleton_key", "publication_status", "updated_at")
VALUES (uuidv7(), 'default', 'NEVER_PUBLISHED', CURRENT_TIMESTAMP);

INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'homepage.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'homepage.edit', CURRENT_TIMESTAMP),
    (uuidv7(), 'homepage.review', CURRENT_TIMESTAMP),
    (uuidv7(), 'homepage.publish', CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator' AND p."key" IN (
    'homepage.read',
    'homepage.edit',
    'homepage.review',
    'homepage.publish'
);
