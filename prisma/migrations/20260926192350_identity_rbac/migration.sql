-- CreateTable
CREATE TABLE "identity"."role" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."permission" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."role_permission" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "identity"."user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "identity"."role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_system_key_key" ON "identity"."role"("system_key");

-- CreateIndex
CREATE UNIQUE INDEX "permission_key_key" ON "identity"."permission"("key");

-- AddForeignKey
ALTER TABLE "identity"."role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "identity"."permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IMP-06 system-defined seed (deterministic, part of the accepted
-- migration process — never seeded at runtime). The five initial
-- permission keys are code-level constants mirrored in
-- src/modules/identity/domain/permissions.ts.
INSERT INTO "identity"."permission" ("id", "key", "created_at") VALUES
    (uuidv7(), 'backoffice.access', CURRENT_TIMESTAMP),
    (uuidv7(), 'identity.users.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'identity.user_roles.manage', CURRENT_TIMESTAMP),
    (uuidv7(), 'identity.roles.read', CURRENT_TIMESTAMP),
    (uuidv7(), 'identity.roles.manage', CURRENT_TIMESTAMP);

-- Built-in system Role — granted all five permissions through normal
-- role_permission rows; no code-level bypass.
INSERT INTO "identity"."role"
    ("id", "name", "description", "system_key", "is_active", "created_at", "updated_at")
VALUES
    (uuidv7(), 'Administrator', 'Built-in system role holding every defined permission.', 'administrator', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "identity"."role_permission" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "identity"."role" r
CROSS JOIN "identity"."permission" p
WHERE r."system_key" = 'administrator';
