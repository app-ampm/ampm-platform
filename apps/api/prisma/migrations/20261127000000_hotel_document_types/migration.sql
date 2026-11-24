-- The hotel documents library's types (D-187 §3 and §6; docs/planning/hotel-information-form-plan.md
-- §6.2, Slice 6): `fact_sheet`, `beverage_menu` and `floor_plan`. `menu` keeps its value and now means
-- the food menu. Expand only: no row changes, and no other column or table. None of the values added by
-- ALTER TYPE is used in this file: a value added by ALTER TYPE cannot be used before its transaction
-- commits. The previous image never lists a hotel's documents, but it would answer 500 on a link to one
-- of these types (its client cannot read the value), so a rollback past this release soft-deletes the
-- `hotel` documents first (docs/data-model.md §16). Production held no documents of the hotel owner when
-- this was written (24 November 2026).

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'fact_sheet';
ALTER TYPE "DocumentType" ADD VALUE 'beverage_menu';
ALTER TYPE "DocumentType" ADD VALUE 'floor_plan';
