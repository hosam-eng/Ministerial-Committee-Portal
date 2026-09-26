-- CreateTable
CREATE TABLE "identity"."totp_replay_guard" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fingerprint" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "totp_replay_guard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "totp_replay_guard_fingerprint_key" ON "identity"."totp_replay_guard"("fingerprint");

-- AddForeignKey
ALTER TABLE "identity"."totp_replay_guard" ADD CONSTRAINT "totp_replay_guard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
