import type { HotelFormRange } from "./hotel-form-fields";
import type { HotelFormSectionAnswers } from "./hotel-form-sections";

/*
 * The hotel form's half-filled pairs (D-190 §2, as fixed after the reviews): an area's unit without its
 * number, a seated or floating range with one end missing, and an other layout without the most guests it
 * takes. A draft keeps them, so one half-typed pair never blocks a save of the rest of its section; a
 * section holding one is not complete, and the submit check lists each as an item to fix, on any request,
 * with the path of the member that is missing inside the section's answers.
 */

/** A pair's missing member: its path inside the section's answers, and what to do. */
export interface HotelFormPairGap {
  readonly field: string;
  readonly message: string;
}

type Venues = HotelFormSectionAnswers["venues"];
type RoomRow = NonNullable<HotelFormSectionAnswers["rooms"]["rows"]>[number];
type VenueRow = NonNullable<Venues["rows"]>[number];

/** An area as a draft holds it: its unit, and its number when given. */
interface DraftArea {
  readonly value?: number | null | undefined;
}

/** What each end of a capacity's range is asked for. */
interface RangeWords {
  readonly min: string;
  readonly max: string;
}

const SEATED: RangeWords = {
  min: "Give the fewest guests seated",
  max: "Give the most guests seated",
};
const FLOATING: RangeWords = {
  min: "Give the fewest guests floating",
  max: "Give the most guests floating",
};
const LAYOUT_MAX = "Give the most guests this layout takes";

const isGiven = (value: unknown): boolean => value !== null && value !== undefined;

/**
 * Whether an area is answered in full: its number with its unit.
 *
 * @example
 * isAreaGiven({ unit: "sqft" }); // false
 */
export function isAreaGiven(area: DraftArea | null | undefined): boolean {
  return isGiven(area) && isGiven(area?.value);
}

/**
 * Whether a capacity is answered in full: a number of guests, or a range with both ends.
 *
 * @example
 * isCapacityGiven({ min: 250 }); // false
 */
export function isCapacityGiven(capacity: number | HotelFormRange | null | undefined): boolean {
  if (capacity === null || capacity === undefined) return false;
  return typeof capacity === "number" || (isGiven(capacity.min) && isGiven(capacity.max));
}

function areaGap(area: DraftArea | null | undefined, field: string, message: string) {
  return isGiven(area) && !isGiven(area?.value) ? [{ field: `${field}.value`, message }] : [];
}

/** A range with one end given and the other not; both missing is no answer, not a half-filled one. */
function rangeGaps(
  capacity: number | HotelFormRange | null | undefined,
  field: string,
  words: RangeWords,
): HotelFormPairGap[] {
  if (capacity === null || capacity === undefined || typeof capacity === "number") return [];
  if (!isGiven(capacity.min) && !isGiven(capacity.max)) return [];
  return [
    ...(isGiven(capacity.min) ? [] : [{ field: `${field}.min`, message: words.min }]),
    ...(isGiven(capacity.max) ? [] : [{ field: `${field}.max`, message: words.max }]),
  ];
}

/**
 * A room row's half-filled pairs: its size without its number.
 *
 * @example
 * roomRowGaps({ rowId, size: { unit: "sqft" } }, 0);
 * // [{ field: "rows.0.size.value", message: "Enter the size" }]
 */
export function roomRowGaps(row: RoomRow, index: number): HotelFormPairGap[] {
  return areaGap(row.size, `rows.${index}.size`, "Enter the size");
}

/** A venue row's half-filled pairs: its area, seated, floating, other layouts and pre-function area. */
export function venueRowGaps(row: VenueRow, index: number): HotelFormPairGap[] {
  const at = (field: string) => `rows.${index}.${field}`;
  const layouts = (row.otherLayouts ?? []).flatMap((layout, place) =>
    isGiven(layout.max) ? [] : [{ field: at(`otherLayouts.${place}.max`), message: LAYOUT_MAX }],
  );
  return [
    ...areaGap(row.area, at("area"), "Enter the area"),
    ...rangeGaps(row.seated, at("seated"), SEATED),
    ...rangeGaps(row.floating, at("floating"), FLOATING),
    ...layouts,
    ...areaGap(row.prefunctionArea, at("prefunctionArea"), "Enter the pre-function area"),
  ];
}

/** The venues section's own half-filled pair, beside its rows': the total event space. */
export function venuesTotalGaps(answers: Venues): HotelFormPairGap[] {
  return areaGap(answers.totalEventSpace, "totalEventSpace", "Enter the total event space");
}
