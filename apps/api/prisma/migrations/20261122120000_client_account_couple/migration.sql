-- The couple on a client account: the bride and groom, each with their father's
-- name. Additive and nullable (expand-and-contract), no backfill: an existing
-- free-text couple_names stays as it is until staff give the bride and groom,
-- when the account is renamed after them ("Priya & Arjun"). The two names are
-- capped at 120 so the couple's name fits the 255 characters of `name`.
ALTER TABLE "client_accounts" ADD COLUMN     "bride_name" VARCHAR(120),
ADD COLUMN     "bride_father_name" VARCHAR(255),
ADD COLUMN     "groom_name" VARCHAR(120),
ADD COLUMN     "groom_father_name" VARCHAR(255);
