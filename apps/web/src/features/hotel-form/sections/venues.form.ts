import {
  hotelFormVenueRow,
  hotelFormVenuesDraft,
  type HotelFormAreaUnit,
  type HotelFormSectionAnswers,
} from "@ampm/core";

import {
  DEFAULT_AREA_UNIT,
  answerReader,
  areaInput,
  areaText,
  capacityInput,
  capacityText,
  choiceInput,
  fieldId,
  isBlankRow,
  numberInput,
  numberText,
  textOf,
  type AnswerReader,
} from "./field-values";
import { VENUE_FIELDS_COPY as COPY } from "./section-fields-copy";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Venues (plan §5.1: the venue table and the total event space; D-190 §2): up to 40 venues keyed by their
 * row ids, each with its setting, type, area, seated and floating capacity (a number or a range), theatre,
 * up to 12 other layouts, dimensions, pre-function area and notes. A refused field is sent as the venue
 * with that id was saved; a layout the page cannot read keeps the venue's saved layouts.
 */

type Answers = HotelFormSectionAnswers["venues"];
type Row = NonNullable<Answers["rows"]>[number];
type Layouts = Row["otherLayouts"];

const SHAPE = hotelFormVenuesDraft.shape;
const ROW = hotelFormVenueRow.shape;

/** One of a venue's other layouts as typed: its name, and its guests ("120", or "30–40"). */
export interface LayoutFields {
  readonly key: string;
  readonly layout: string;
  readonly guests: string;
}

export interface VenueRowFields {
  readonly rowId: string;
  readonly name: string;
  /** indoor, outdoor, semi_open, or "". */
  readonly setting: string;
  /** One of the catalogue's venue types, or "". */
  readonly venueType: string;
  readonly areaValue: string;
  readonly areaUnit: HotelFormAreaUnit;
  readonly seated: string;
  readonly floating: string;
  readonly theatre: string;
  readonly layouts: readonly LayoutFields[];
  readonly lengthM: string;
  readonly widthM: string;
  readonly ceilingHeightM: string;
  readonly prefunctionValue: string;
  readonly prefunctionUnit: HotelFormAreaUnit;
  readonly notes: string;
}

export interface VenuesFields {
  readonly totalSpaceValue: string;
  readonly totalSpaceUnit: HotelFormAreaUnit;
  readonly rows: readonly VenueRowFields[];
  readonly noLongerOffered: string;
}

/** A venues field's id: the section's, a venue's field by its row id, or a layout's part. */
export const venuesId = (...parts: readonly string[]) => fieldId("venues", ...parts);

/** A venue with nothing typed yet, under the id the page made for it. */
export const emptyVenue = (rowId: string): VenueRowFields => ({
  rowId,
  name: "",
  setting: "",
  venueType: "",
  areaValue: "",
  areaUnit: DEFAULT_AREA_UNIT,
  seated: "",
  floating: "",
  theatre: "",
  layouts: [],
  lengthM: "",
  widthM: "",
  ceilingHeightM: "",
  prefunctionValue: "",
  prefunctionUnit: DEFAULT_AREA_UNIT,
  notes: "",
});

function rowFieldsOf(row: Row, newKey: () => string): VenueRowFields {
  const area = areaText(row.area);
  const prefunction = areaText(row.prefunctionArea);
  const layouts = (row.otherLayouts ?? []).map((entry) => ({
    key: newKey(),
    layout: entry.layout,
    guests: capacityText(entry.min === undefined ? entry.max : { min: entry.min, max: entry.max }),
  }));
  return {
    rowId: row.rowId,
    name: textOf(row.name),
    setting: textOf(row.setting),
    venueType: textOf(row.venueType),
    areaValue: area.value,
    areaUnit: area.unit,
    seated: capacityText(row.seated),
    floating: capacityText(row.floating),
    theatre: numberText(row.theatre),
    layouts,
    lengthM: numberText(row.lengthM),
    widthM: numberText(row.widthM),
    ceilingHeightM: numberText(row.ceilingHeightM),
    prefunctionValue: prefunction.value,
    prefunctionUnit: prefunction.unit,
    notes: textOf(row.notes),
  };
}

function fieldsOf(answers: Answers, newKey: () => string): VenuesFields {
  const total = areaText(answers.totalEventSpace);
  const rows = answers.rows ?? [];
  return {
    totalSpaceValue: total.value,
    totalSpaceUnit: total.unit,
    rows: rows.length === 0 ? [emptyVenue(newKey())] : rows.map((row) => rowFieldsOf(row, newKey)),
    noLongerOffered: textOf(answers.noLongerOffered),
  };
}

/** One layout as the catalogue keeps it, or null when the page cannot read it (said on its field). */
function layoutOf(r: AnswerReader, rowId: string, entry: LayoutFields) {
  const id = (part: string) => venuesId(rowId, "layouts", entry.key, part);
  const layout = entry.layout.trim();
  const guests = capacityInput(entry.guests);
  if (layout === "") r.refuse(id("layout"), COPY.layoutNameMissing);
  if (guests === null) r.refuse(id("guests"), COPY.layoutGuestsMissing);
  else if (typeof guests !== "number" && !isRange(guests))
    r.refuse(id("guests"), COPY.layoutGuestsUnread);
  if (layout === "") return null;
  if (typeof guests === "number") return { layout, max: guests };
  return isRange(guests) ? { layout, min: guests.min, max: guests.max } : null;
}

function isRange(value: unknown): value is { readonly min: number; readonly max: number } {
  return typeof value === "object" && value !== null && "min" in value && "max" in value;
}

/** A venue's other layouts: the ones typed, else the venue's saved ones while one cannot be read. */
function readLayouts(r: AnswerReader, row: VenueRowFields, saved: Row | undefined): Layouts {
  const typed = row.layouts.filter((entry) => `${entry.layout}${entry.guests}`.trim() !== "");
  const entries = typed.map((entry) => layoutOf(r, row.rowId, entry));
  const layouts = entries.filter((entry) => entry !== null);
  if (layouts.length < entries.length) return saved?.otherLayouts;
  const input = layouts.length === 0 ? null : layouts;
  return r.read(venuesId(row.rowId, "layouts"), ROW.otherLayouts, input, saved?.otherLayouts);
}

/** A venue with nothing typed in it (its layouts included): not sent. */
const isBlankVenue = (row: VenueRowFields): boolean =>
  isBlankRow([
    row.name,
    row.setting,
    row.venueType,
    row.areaValue,
    row.seated,
    row.floating,
    row.theatre,
    row.lengthM,
    row.widthM,
    row.ceilingHeightM,
    row.prefunctionValue,
    row.notes,
    ...row.layouts.flatMap((layout) => [layout.layout, layout.guests]),
  ]);

function readRow(r: AnswerReader, row: VenueRowFields, saved: Row | undefined): Row {
  const id = (part: string) => venuesId(row.rowId, part);
  const area = { value: row.areaValue, unit: row.areaUnit };
  const prefunction = { value: row.prefunctionValue, unit: row.prefunctionUnit };
  const metres = (key: "lengthM" | "widthM" | "ceilingHeightM") =>
    r.read(id(key), ROW[key], numberInput(row[key]), saved?.[key]);
  return {
    rowId: row.rowId,
    name: r.read(id("name"), ROW.name, row.name, saved?.name),
    setting: r.read(id("setting"), ROW.setting, choiceInput(row.setting), saved?.setting),
    venueType: r.read(id("venueType"), ROW.venueType, choiceInput(row.venueType), saved?.venueType),
    area: r.read(id("area"), ROW.area, areaInput(area), saved?.area),
    seated: r.read(id("seated"), ROW.seated, capacityInput(row.seated), saved?.seated),
    floating: r.read(id("floating"), ROW.floating, capacityInput(row.floating), saved?.floating),
    theatre: r.read(id("theatre"), ROW.theatre, numberInput(row.theatre), saved?.theatre),
    otherLayouts: readLayouts(r, row, saved),
    lengthM: metres("lengthM"),
    widthM: metres("widthM"),
    ceilingHeightM: metres("ceilingHeightM"),
    prefunctionArea: r.read(
      id("prefunctionArea"),
      ROW.prefunctionArea,
      areaInput(prefunction),
      saved?.prefunctionArea,
    ),
    notes: r.read(id("notes"), ROW.notes, row.notes, saved?.notes),
  };
}

function answersOf(fields: VenuesFields, saved: Answers): BuiltAnswers<"venues"> {
  const r = answerReader();
  const savedRows = new Map((saved.rows ?? []).map((row) => [row.rowId, row]));
  const total = { value: fields.totalSpaceValue, unit: fields.totalSpaceUnit };
  const answers: Answers = {
    totalEventSpace: r.read(
      venuesId("totalEventSpace"),
      SHAPE.totalEventSpace,
      areaInput(total),
      saved.totalEventSpace,
    ),
    rows: fields.rows
      .filter((row) => !isBlankVenue(row))
      .map((row) => readRow(r, row, savedRows.get(row.rowId))),
    noLongerOffered: r.read(
      venuesId("noLongerOffered"),
      SHAPE.noLongerOffered,
      fields.noLongerOffered,
      saved.noLongerOffered,
    ),
  };
  return { answers, errors: r.errors };
}

/**
 * The venues section's fields and their reading.
 *
 * @example
 * const fields = VENUES_MODEL.fieldsOf(draft.sections.venues.answers, () => crypto.randomUUID());
 */
export const VENUES_MODEL: SectionModel<"venues", VenuesFields> = { fieldsOf, answersOf };
