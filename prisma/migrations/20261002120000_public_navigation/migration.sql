-- IMP-16 Public Navigation Management

CREATE SCHEMA IF NOT EXISTS "public_navigation";

CREATE TYPE "public_navigation"."PublicNavigationPublicationStatus" AS ENUM ('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED');
CREATE TYPE "public_navigation"."PublicNavigationWorkflowStatus" AS ENUM ('EDITING', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');
CREATE TYPE "public_navigation"."PublicNavigationWorkflowAction" AS ENUM ('SUBMIT', 'RETURN', 'APPROVE', 'RESTORE');
CREATE TYPE "public_navigation"."PublicNavigationPublicationAction" AS ENUM ('PUBLISH', 'UNPUBLISH');
CREATE TYPE "public_navigation"."PublicNavigationLocation" AS ENUM ('MAIN', 'UTILITY', 'FOOTER');
CREATE TYPE "public_navigation"."PublicNavigationItemType" AS ENUM ('GROUP', 'SYSTEM_ROUTE', 'CONTENT_ROUTE', 'EXTERNAL_LINK');
CREATE TYPE "public_navigation"."PublicNavigationContentTargetKind" AS ENUM ('MANAGED_PAGE');

CREATE TABLE "public_navigation"."public_navigation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "singleton_key" TEXT NOT NULL,
    "publication_status" "public_navigation"."PublicNavigationPublicationStatus" NOT NULL DEFAULT 'NEVER_PUBLISHED',
    "live_revision_id" UUID,
    "active_revision_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "unpublished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_navigation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_navigation"."public_navigation_revision" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "public_navigation_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "workflow_status" "public_navigation"."PublicNavigationWorkflowStatus" NOT NULL DEFAULT 'EDITING',
    "edit_version" INTEGER NOT NULL DEFAULT 0,
    "based_on_revision_id" UUID,
    "created_by_id" UUID,
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_navigation_revision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_navigation"."public_navigation_item" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "revision_id" UUID NOT NULL,
    "item_key" UUID NOT NULL,
    "location" "public_navigation"."PublicNavigationLocation" NOT NULL,
    "item_type" "public_navigation"."PublicNavigationItemType" NOT NULL,
    "parent_item_key" UUID,
    "sibling_order" INTEGER NOT NULL,
    "label_ar" TEXT NOT NULL DEFAULT '',
    "label_en" TEXT NOT NULL DEFAULT '',
    "system_route_key" TEXT,
    "content_target_kind" "public_navigation"."PublicNavigationContentTargetKind",
    "content_target_id" UUID,
    "external_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_navigation_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_navigation"."public_navigation_workflow_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "public_navigation_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "public_navigation"."PublicNavigationWorkflowAction" NOT NULL,
    "from_status" "public_navigation"."PublicNavigationWorkflowStatus" NOT NULL,
    "to_status" "public_navigation"."PublicNavigationWorkflowStatus" NOT NULL,
    "comment" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_navigation_workflow_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_navigation"."public_navigation_publication_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "public_navigation_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "public_navigation"."PublicNavigationPublicationAction" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_navigation_publication_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_navigation_singleton_key_key" ON "public_navigation"."public_navigation"("singleton_key");
CREATE UNIQUE INDEX "public_navigation_active_revision_id_key" ON "public_navigation"."public_navigation"("active_revision_id");
CREATE UNIQUE INDEX "public_navigation_revision_public_navigation_id_revision_number_key" ON "public_navigation"."public_navigation_revision"("public_navigation_id", "revision_number");
CREATE UNIQUE INDEX "public_navigation_item_revision_id_item_key_key" ON "public_navigation"."public_navigation_item"("revision_id", "item_key");
CREATE INDEX "public_navigation_revision_public_navigation_id_idx" ON "public_navigation"."public_navigation_revision"("public_navigation_id");
CREATE INDEX "public_navigation_item_revision_id_idx" ON "public_navigation"."public_navigation_item"("revision_id");
CREATE INDEX "public_navigation_item_revision_id_location_idx" ON "public_navigation"."public_navigation_item"("revision_id", "location");
CREATE INDEX "public_navigation_workflow_event_public_navigation_id_idx" ON "public_navigation"."public_navigation_workflow_event"("public_navigation_id");
CREATE INDEX "public_navigation_publication_event_public_navigation_id_idx" ON "public_navigation"."public_navigation_publication_event"("public_navigation_id");
CREATE INDEX "public_navigation_item_content_target_idx" ON "public_navigation"."public_navigation_item"("content_target_kind", "content_target_id");

ALTER TABLE "public_navigation"."public_navigation"
    ADD CONSTRAINT "public_navigation_live_revision_id_fkey"
    FOREIGN KEY ("live_revision_id") REFERENCES "public_navigation"."public_navigation_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation"
    ADD CONSTRAINT "public_navigation_active_revision_id_fkey"
    FOREIGN KEY ("active_revision_id") REFERENCES "public_navigation"."public_navigation_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_revision"
    ADD CONSTRAINT "public_navigation_revision_public_navigation_id_fkey"
    FOREIGN KEY ("public_navigation_id") REFERENCES "public_navigation"."public_navigation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_revision"
    ADD CONSTRAINT "public_navigation_revision_based_on_revision_id_fkey"
    FOREIGN KEY ("based_on_revision_id") REFERENCES "public_navigation"."public_navigation_revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_item"
    ADD CONSTRAINT "public_navigation_item_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "public_navigation"."public_navigation_revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_workflow_event"
    ADD CONSTRAINT "public_navigation_workflow_event_public_navigation_id_fkey"
    FOREIGN KEY ("public_navigation_id") REFERENCES "public_navigation"."public_navigation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_workflow_event"
    ADD CONSTRAINT "public_navigation_workflow_event_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "public_navigation"."public_navigation_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_publication_event"
    ADD CONSTRAINT "public_navigation_publication_event_public_navigation_id_fkey"
    FOREIGN KEY ("public_navigation_id") REFERENCES "public_navigation"."public_navigation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_publication_event"
    ADD CONSTRAINT "public_navigation_publication_event_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "public_navigation"."public_navigation_revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_navigation"."public_navigation_revision"
    ADD CONSTRAINT "public_navigation_revision_number_ck" CHECK ("revision_number" >= 1),
    ADD CONSTRAINT "public_navigation_revision_edit_version_ck" CHECK ("edit_version" >= 0);

ALTER TABLE "public_navigation"."public_navigation_item"
    ADD CONSTRAINT "public_navigation_item_sibling_order_ck" CHECK ("sibling_order" >= 0);

INSERT INTO "public_navigation"."public_navigation" ("id", "singleton_key", "publication_status", "updated_at")
VALUES (uuidv7(), 'default', 'NEVER_PUBLISHED', CURRENT_TIMESTAMP);

INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'navigation.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'navigation.edit', CURRENT_TIMESTAMP),
    (uuidv7(), 'navigation.review', CURRENT_TIMESTAMP),
    (uuidv7(), 'navigation.publish', CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator' AND p."key" IN (
    'navigation.read',
    'navigation.edit',
    'navigation.review',
    'navigation.publish'
);
