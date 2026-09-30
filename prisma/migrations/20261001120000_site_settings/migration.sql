-- IMP-15 Site Settings: singleton aggregate, revision workflow, permissions.

CREATE SCHEMA IF NOT EXISTS "site_settings";

CREATE TYPE "site_settings"."SiteSettingsPublicationStatus" AS ENUM ('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED');
CREATE TYPE "site_settings"."SiteSettingsWorkflowStatus" AS ENUM ('EDITING', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');
CREATE TYPE "site_settings"."SiteSettingsWorkflowAction" AS ENUM ('SUBMIT', 'RETURN', 'APPROVE', 'RESTORE');
CREATE TYPE "site_settings"."SiteSettingsPublicationAction" AS ENUM ('PUBLISH', 'UNPUBLISH');

CREATE TABLE "site_settings"."site_settings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "singleton_key" TEXT NOT NULL,
    "publication_status" "site_settings"."SiteSettingsPublicationStatus" NOT NULL DEFAULT 'NEVER_PUBLISHED',
    "live_revision_id" UUID,
    "active_revision_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "unpublished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings"."site_settings_revision" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "site_settings_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "workflow_status" "site_settings"."SiteSettingsWorkflowStatus" NOT NULL DEFAULT 'EDITING',
    "edit_version" INTEGER NOT NULL DEFAULT 0,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "based_on_revision_id" UUID,
    "created_by_id" UUID,
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_settings_revision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings"."site_settings_revision_translation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "official_name" TEXT NOT NULL DEFAULT '',
    "address" TEXT,
    "default_seo_title" TEXT,
    "default_seo_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_settings_revision_translation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings"."site_settings_social_link" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "item_key" TEXT NOT NULL,
    "label_ar" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_social_link_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings"."site_settings_workflow_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "site_settings_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "site_settings"."SiteSettingsWorkflowAction" NOT NULL,
    "from_status" "site_settings"."SiteSettingsWorkflowStatus" NOT NULL,
    "to_status" "site_settings"."SiteSettingsWorkflowStatus" NOT NULL,
    "comment" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_workflow_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings"."site_settings_publication_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "site_settings_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "site_settings"."SiteSettingsPublicationAction" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_publication_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_settings_singleton_key_key" ON "site_settings"."site_settings"("singleton_key");
CREATE UNIQUE INDEX "site_settings_active_revision_id_key" ON "site_settings"."site_settings"("active_revision_id");

CREATE UNIQUE INDEX "site_settings_revision_site_settings_id_revision_number_key"
    ON "site_settings"."site_settings_revision"("site_settings_id", "revision_number");
CREATE INDEX "site_settings_revision_site_settings_id_idx" ON "site_settings"."site_settings_revision"("site_settings_id");

CREATE UNIQUE INDEX "site_settings_revision_translation_revision_id_locale_key"
    ON "site_settings"."site_settings_revision_translation"("revision_id", "locale");

CREATE UNIQUE INDEX "site_settings_social_link_revision_id_item_key_key"
    ON "site_settings"."site_settings_social_link"("revision_id", "item_key");
CREATE UNIQUE INDEX "site_settings_social_link_revision_id_position_key"
    ON "site_settings"."site_settings_social_link"("revision_id", "position");
CREATE INDEX "site_settings_social_link_revision_id_idx" ON "site_settings"."site_settings_social_link"("revision_id");

CREATE INDEX "site_settings_workflow_event_site_settings_id_idx" ON "site_settings"."site_settings_workflow_event"("site_settings_id");
CREATE INDEX "site_settings_publication_event_site_settings_id_idx" ON "site_settings"."site_settings_publication_event"("site_settings_id");

ALTER TABLE "site_settings"."site_settings"
    ADD CONSTRAINT "site_settings_live_revision_id_fkey"
    FOREIGN KEY ("live_revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings"
    ADD CONSTRAINT "site_settings_active_revision_id_fkey"
    FOREIGN KEY ("active_revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_revision"
    ADD CONSTRAINT "site_settings_revision_site_settings_id_fkey"
    FOREIGN KEY ("site_settings_id") REFERENCES "site_settings"."site_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_revision"
    ADD CONSTRAINT "site_settings_revision_based_on_revision_id_fkey"
    FOREIGN KEY ("based_on_revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_revision_translation"
    ADD CONSTRAINT "site_settings_revision_translation_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_social_link"
    ADD CONSTRAINT "site_settings_social_link_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_workflow_event"
    ADD CONSTRAINT "site_settings_workflow_event_site_settings_id_fkey"
    FOREIGN KEY ("site_settings_id") REFERENCES "site_settings"."site_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_workflow_event"
    ADD CONSTRAINT "site_settings_workflow_event_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_publication_event"
    ADD CONSTRAINT "site_settings_publication_event_site_settings_id_fkey"
    FOREIGN KEY ("site_settings_id") REFERENCES "site_settings"."site_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_publication_event"
    ADD CONSTRAINT "site_settings_publication_event_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "site_settings"."site_settings_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_settings"."site_settings_revision"
    ADD CONSTRAINT "site_settings_revision_number_ck" CHECK ("revision_number" >= 1),
    ADD CONSTRAINT "site_settings_revision_edit_version_ck" CHECK ("edit_version" >= 0);

ALTER TABLE "site_settings"."site_settings_social_link"
    ADD CONSTRAINT "site_settings_social_link_position_ck" CHECK ("position" >= 0);

INSERT INTO "site_settings"."site_settings" ("id", "singleton_key", "publication_status", "updated_at")
VALUES (uuidv7(), 'default', 'NEVER_PUBLISHED', CURRENT_TIMESTAMP);

INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'site_settings.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'site_settings.edit', CURRENT_TIMESTAMP),
    (uuidv7(), 'site_settings.review', CURRENT_TIMESTAMP),
    (uuidv7(), 'site_settings.publish', CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator' AND p."key" IN (
    'site_settings.read',
    'site_settings.edit',
    'site_settings.review',
    'site_settings.publish'
);
