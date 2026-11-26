-- The client's own estimated budget range on a hotel enquiry (Slice A). Additive and nullable (budget is
-- optional on the brief); `budget_currency` defaults to INR (A-16), so existing rows need no backfill.
-- CLIENT class — the client's stated figure, never an AMPM cost or margin (security.md).
-- AlterTable
ALTER TABLE "hotel_enquiries" ADD COLUMN     "budget_amount_max" DECIMAL(14,2),
ADD COLUMN     "budget_amount_min" DECIMAL(14,2),
ADD COLUMN     "budget_currency" VARCHAR(3) NOT NULL DEFAULT 'INR';
