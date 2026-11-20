-- AlterEnum
ALTER TYPE "AuthTokenPurpose" ADD VALUE 'sign_in_challenge';

-- AlterTable
ALTER TABLE "auth_tokens" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_codes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(6),
ADD COLUMN     "password_hash" VARCHAR(255),
ADD COLUMN     "totp_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "totp_last_step" INTEGER,
ADD COLUMN     "totp_pending_enc" TEXT,
ADD COLUMN     "totp_secret_enc" TEXT;

-- CreateTable
CREATE TABLE "user_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_recovery_codes_user_id_code_hash_key" ON "user_recovery_codes"("user_id", "code_hash");

-- AddForeignKey
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
