import {
  rateItemTypeLabel,
  type HotelImportRowReport,
  type HotelRateItemType,
  type HotelRateItemUnit,
} from "@ampm/core";

/*
 * How the TW-25 import speaks of a Rates row (D-184; Slice 4): the names a row shows after its hotel
 * (its card, its item type in the label the staff rates screens use, its room or venue), and an item
 * type or unit spelled as a Rates file writes it, for the help and the downloaded report. The reader
 * takes an enum cell in any case, a space or a hyphen standing for each underscore
 * (`hotelImportEnumValue`), but keeps brackets, so a cell never carries the label's "(veg)". Pure.
 */

/**
 * An item type as a Rates cell spells it: its staff label without the brackets, which reads back as the
 * type.
 *
 * @example
 * rateItemTypeCell("per_plate_veg"); // "Per plate veg"
 */
export function rateItemTypeCell(type: HotelRateItemType): string {
  return rateItemTypeLabel(type).replace(/[()]/g, "");
}

/**
 * A unit as a Rates cell spells it: its words with spaces, which read back as the unit.
 *
 * @example
 * rateUnitCell("per_night"); // "per night"
 */
export function rateUnitCell(unit: HotelRateItemUnit): string {
  return unit.replace(/_/g, " ");
}

/**
 * The names a Rates row shows after its hotel's web address: its card, its item's type as the staff
 * rates screens label it, and the room or the venue the item is for (neither for an item of the whole
 * card). A row whose item type did not read names its card alone.
 *
 * @example
 * rateRowNames(row); // ["2026-27", "Room rate", "Lake View Suite"]
 */
export function rateRowNames(row: HotelImportRowReport): string[] {
  const { item } = row;
  const names = [
    row.name,
    item ? rateItemTypeLabel(item.itemType) : null,
    item?.roomName,
    item?.venueName,
  ];
  return names.filter((name): name is string => typeof name === "string" && name !== "");
}
