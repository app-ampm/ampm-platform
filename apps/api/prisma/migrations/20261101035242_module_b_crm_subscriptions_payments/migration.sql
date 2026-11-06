-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('hotel_discovery', 'trial', 'demo', 'package');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('one_time', 'recurring');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "PlanModuleAccess" AS ENUM ('read', 'full');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'pending_payment', 'active', 'expiring', 'expired', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "ActivationSource" AS ENUM ('gateway_webhook', 'manual');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "PaymentCounterpartyType" AS ENUM ('client', 'vendor', 'hotel', 'other');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('subscription', 'service_fee', 'milestone', 'vendor_payment', 'hotel_payment', 'refund');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('gateway', 'bank_transfer', 'upi', 'cheque', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('initiated', 'pending', 'succeeded', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('received', 'processed', 'failed', 'ignored');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "plan_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "billing_type" "BillingType" NOT NULL,
    "price_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "term_days" INTEGER,
    "trial_days" INTEGER,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "terms_version" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_modules" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "module_key" VARCHAR(64) NOT NULL,
    "access_level" "PlanModuleAccess" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "trial_ends_at" TIMESTAMPTZ(6),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "activation_source" "ActivationSource",
    "activated_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "project_id" UUID,
    "direction" "PaymentDirection" NOT NULL,
    "counterparty_type" "PaymentCounterpartyType" NOT NULL,
    "counterparty_id" UUID,
    "purpose" "PaymentPurpose" NOT NULL,
    "related_type" VARCHAR(255),
    "related_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "method" "PaymentMethod" NOT NULL,
    "provider" VARCHAR(255),
    "provider_ref" VARCHAR(255),
    "status" "PaymentStatus" NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "recorded_by" UUID,
    "refund_of_payment_id" UUID,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "provider_ref" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'received',
    "error" VARCHAR(1024),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_plan_key_key" ON "plans"("plan_key");

-- CreateIndex
CREATE INDEX "plans_status_idx" ON "plans"("status");

-- CreateIndex
CREATE INDEX "plans_deleted_at_idx" ON "plans"("deleted_at");

-- CreateIndex
CREATE INDEX "plan_modules_plan_id_idx" ON "plan_modules"("plan_id");

-- CreateIndex
CREATE INDEX "plan_modules_deleted_at_idx" ON "plan_modules"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_modules_plan_id_module_key_key" ON "plan_modules"("plan_id", "module_key");

-- CreateIndex
CREATE INDEX "subscriptions_account_id_status_idx" ON "subscriptions"("account_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_ends_at_idx" ON "subscriptions"("ends_at");

-- CreateIndex
CREATE INDEX "subscriptions_deleted_at_idx" ON "subscriptions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments"("provider_ref");

-- CreateIndex
CREATE INDEX "payments_account_id_idx" ON "payments"("account_id");

-- CreateIndex
CREATE INDEX "payments_project_id_idx" ON "payments"("project_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_purpose_idx" ON "payments"("purpose");

-- CreateIndex
CREATE INDEX "payments_related_type_related_id_idx" ON "payments"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");

-- CreateIndex
CREATE INDEX "webhook_events_provider_ref_idx" ON "webhook_events"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider", "event_id");

-- AddForeignKey
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
