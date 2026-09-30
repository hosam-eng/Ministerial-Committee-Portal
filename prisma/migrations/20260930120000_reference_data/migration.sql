-- IMP-14 Reference Data: taxonomies, organizations, geographic areas;
-- NewsCategory active governance column.

CREATE SCHEMA IF NOT EXISTS "reference_data";

-- CreateTable
CREATE TABLE "reference_data"."event_category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_data"."awareness_topic" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "awareness_topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_data"."target_audience" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "target_audience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_data"."publication_type" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "publication_type_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_data"."open_dataset_category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "open_dataset_category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_data"."organization" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_data"."geographic_area" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "code" TEXT,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geographic_area_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "geographic_area_code_key" ON "reference_data"."geographic_area"("code");

CREATE INDEX "geographic_area_parent_id_idx" ON "reference_data"."geographic_area"("parent_id");

ALTER TABLE "reference_data"."geographic_area" ADD CONSTRAINT "geographic_area_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "reference_data"."geographic_area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publishing"."news_category" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'reference_data.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'reference_data.taxonomies.manage', CURRENT_TIMESTAMP),
    (uuidv7(), 'reference_data.organizations.manage', CURRENT_TIMESTAMP),
    (uuidv7(), 'reference_data.geographic_areas.manage', CURRENT_TIMESTAMP),
    (uuidv7(), 'publishing.news_categories.manage', CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator'
  AND p."key" IN (
    'reference_data.read',
    'reference_data.taxonomies.manage',
    'reference_data.organizations.manage',
    'reference_data.geographic_areas.manage',
    'publishing.news_categories.manage'
  );
