-- The rates kind of the staff import (D-181, D-184; docs/planning/hotel-information-form-plan.md §4.8,
-- Slice 4): import jobs of kind `hotel_rates`, which a Rates preview records and its import applies. Nothing
-- else changes: a rates preview keeps its plan in import_jobs.plan_json as every kind does, and it loads
-- into the existing rate card and rate item tables. Additive: the previous image never lists import jobs
-- and reads one only by id through a kind's apply route, so a `hotel_rates` job sent there answers 500 on
-- it rather than 404, and needs no remap on a rollback. The value added by ALTER TYPE is not used in this
-- file: a value added by ALTER TYPE cannot be used before its transaction commits. Production held no
-- hotels, rate cards or import jobs when this was written (24 November 2026).

-- AlterEnum
ALTER TYPE "ImportType" ADD VALUE 'hotel_rates';
