import { hotelFormAreaUnit, type HotelFormAreaUnit } from "@ampm/core";

import { DEFAULT_AREA_UNIT } from "./field-values";
import { COMMON_FIELDS_COPY } from "./section-fields-copy";

/** The units an area is given in, as a NumberUnitField offers them: sq ft, then m². */
export const AREA_UNITS = hotelFormAreaUnit.options.map((unit) => ({
  value: unit,
  label: COMMON_FIELDS_COPY.units[unit],
}));

/**
 * A unit list's value as an area unit (the list offers no other; anything else keeps sq ft).
 *
 * @example
 * areaUnitOf("sqm"); // "sqm"
 */
export function areaUnitOf(value: string): HotelFormAreaUnit {
  const parsed = hotelFormAreaUnit.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_AREA_UNIT;
}
