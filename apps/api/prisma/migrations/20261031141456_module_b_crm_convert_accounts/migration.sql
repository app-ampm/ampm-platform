-- CreateEnum
CREATE TYPE "ClientAccountStatus" AS ENUM ('prospect', 'active', 'suspended', 'closed');

-- CreateTable
CREATE TABLE "client_accounts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "couple_names" VARCHAR(255),
    "preferred_locations" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "status" "ClientAccountStatus" NOT NULL DEFAULT 'prospect',
    "primary_contact_user_id" UUID,
    "lead_id" UUID,
    "billing_name" VARCHAR(255),
    "billing_address" TEXT,
    "gstin" VARCHAR(15),
    "internal_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_contacts" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "relation" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(255),
    "is_decision_maker" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "account_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_accounts_lead_id_key" ON "client_accounts"("lead_id");

-- CreateIndex
CREATE INDEX "client_accounts_status_idx" ON "client_accounts"("status");

-- CreateIndex
CREATE INDEX "client_accounts_primary_contact_user_id_idx" ON "client_accounts"("primary_contact_user_id");

-- CreateIndex
CREATE INDEX "client_accounts_deleted_at_idx" ON "client_accounts"("deleted_at");

-- CreateIndex
CREATE INDEX "account_contacts_account_id_idx" ON "account_contacts"("account_id");

-- CreateIndex
CREATE INDEX "account_contacts_user_id_idx" ON "account_contacts"("user_id");

-- CreateIndex
CREATE INDEX "account_contacts_deleted_at_idx" ON "account_contacts"("deleted_at");

-- AddForeignKey
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_primary_contact_user_id_fkey" FOREIGN KEY ("primary_contact_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_contacts" ADD CONSTRAINT "account_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_contacts" ADD CONSTRAINT "account_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
