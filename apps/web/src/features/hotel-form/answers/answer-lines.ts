import {
  HOTEL_CUISINE_OTHER,
  HOTEL_FACILITY_OTHER,
  type HotelFormArea,
  type HotelFormSectionAnswers,
  type HotelFormSectionKey,
} from "@ampm/core";

import { SECTIONS_COPY } from "../sections-copy";
import { capacityText, numberText } from "../sections/field-values";
import {
  BOOKING_FIELDS_COPY as BOOKING,
  COMMON_FIELDS_COPY as COMMON,
  CONTACT_FIELDS_COPY as CONTACT,
  FACT_SHEET_FIELDS_COPY as FACT_SHEET,
  FOOD_FIELDS_COPY as FOOD,
  PROPERTY_FIELDS_COPY as PROPERTY,
  ROOM_FIELDS_COPY as ROOM,
  VENUE_FIELDS_COPY as VENUE,
} from "../sections/section-fields-copy";
import { layoutGuestsText } from "../sections/venues.form";
import { ANSWERS_COPY as COPY } from "./answers-copy";

/*
 * A section's saved answers in words (D-190 §5): what HF-06's summary and HF-07's read-only answers show.
 * Only what was answered, in the order and the words the section asks it; a contact, room or venue under
 * its own heading. A pair whose other half is not given yet (an area's unit alone) is no answer here: the
 * review page's missing items name it.
 */

/** One answered question: its words, and the answer as the page shows it. */
export interface AnswerLine {
  readonly label: string;
  readonly value: string;
}

/** A row's answers under its own heading: a contact, a room category, a venue. */
export interface AnswerGroup {
  /** The row's id (a contact's place), for React's list. */
  readonly key: string;
  readonly heading: string;
  readonly lines: readonly AnswerLine[];
}

/** A section's answers to show: its own questions, then its rows. */
export interface SectionAnswerLines {
  readonly lines: readonly AnswerLine[];
  readonly groups: readonly AnswerGroup[];
}

type Answers = HotelFormSectionAnswers;
type Text = string | null | undefined;

/** The lines whose answer is given, in order. */
const answered = (...lines: readonly (readonly [string, Text])[]): AnswerLine[] =>
  lines.flatMap(([label, value]) =>
    value === null || value === undefined || value === "" ? [] : [{ label, value }],
  );

const yesNo = (value: boolean | null | undefined): Text =>
  value === true ? COMMON.yes : value === false ? COMMON.no : null;

const count = (value: number | null | undefined): Text => numberText(value);

const areaOf = (area: HotelFormArea | null | undefined): Text =>
  area?.value === null || area?.value === undefined
    ? null
    : `${area.value} ${COMMON.units[area.unit]}`;

/** A place a guest travels from: its name, the km and the drive, as far as they are given. */
function accessOf(point: Answers["property"]["airport"]): Text {
  if (point === null || point === undefined) return null;
  const parts = [
    point.name ?? null,
    point.km === null || point.km === undefined ? null : COPY.km(point.km),
    point.minutes === null || point.minutes === undefined ? null : COPY.minutes(point.minutes),
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : COPY.joinParts(parts);
}

/** Chips chosen: Other stands among them only while its own words were not given. */
function chipsOf(
  chosen: readonly string[] | null | undefined,
  other: string,
  otherText: Text,
): Text {
  const shown = (chosen ?? []).filter((chip) => chip !== other || !otherText);
  return shown.length === 0 ? null : COPY.joinChoices(shown);
}

/** A Yes, No or Depends answer stored under its own words (`required`, `allowed`…). */
const choiceOf = (
  value: string | null | undefined,
  words: Readonly<Record<string, string>>,
): Text => (value === null || value === undefined ? null : (words[value] ?? null));

const BUYOUT = { required: COMMON.yes, not_required: COMMON.no, depends: COMMON.depends };
const PARALLEL = { allowed: COMMON.yes, not_allowed: COMMON.no, depends: COMMON.depends };

const refreshNote = (note: Text) => answered([SECTIONS_COPY.refresh.noLongerOffered, note]);

/** Rows with any answer, each under its heading; a blank row is left out. */
const groupsOf = (groups: readonly AnswerGroup[]): AnswerGroup[] =>
  groups.filter((group) => group.lines.length > 0);

function property(a: Answers["property"]): SectionAnswerLines {
  const lines = answered(
    [PROPERTY.name, a.name],
    [PROPERTY.isChain, yesNo(a.isChain)],
    [PROPERTY.groupName, a.groupName],
    [PROPERTY.street, a.street],
    [PROPERTY.locality, a.locality],
    [PROPERTY.city, a.city],
    [PROPERTY.state, a.state],
    [PROPERTY.postalCode, a.postalCode],
    [PROPERTY.mapsUrl, a.mapsUrl],
    [PROPERTY.website, a.website],
    [PROPERTY.access.airport.legend, accessOf(a.airport)],
    [PROPERTY.access.railwayStation.legend, accessOf(a.railwayStation)],
    [PROPERTY.access.cityCentre.legend, accessOf(a.cityCentre)],
    [PROPERTY.accessNotes, a.accessNotes],
    [PROPERTY.starCategory, a.starCategory],
    [PROPERTY.description, a.description],
    [PROPERTY.facilities, chipsOf(a.facilities, HOTEL_FACILITY_OTHER, a.facilitiesOther)],
    [PROPERTY.facilitiesOther, a.facilitiesOther],
  );
  return { lines: [...lines, ...refreshNote(a.noLongerOffered)], groups: [] };
}

function contact(a: Answers["contact"]): SectionAnswerLines {
  const groups = (a.contacts ?? []).map((person, place) => ({
    key: `contact-${place}`,
    heading: CONTACT.row(place + 1),
    lines: answered(
      [CONTACT.name, person.name],
      [CONTACT.role, person.role],
      [CONTACT.phone, person.phone],
      [CONTACT.email, person.email],
    ),
  }));
  return { lines: refreshNote(a.noLongerOffered), groups: groupsOf(groups) };
}

type RoomRow = NonNullable<Answers["rooms"]["rows"]>[number];

const roomLines = (row: RoomRow) =>
  answered(
    [ROOM.roomCount, count(row.roomCount)],
    [ROOM.unitType, choiceOf(row.unitType, ROOM.unitTypes)],
    [ROOM.size, areaOf(row.size)],
    [ROOM.maxOccupancy, count(row.maxOccupancy)],
    [ROOM.viewLabel, row.viewLabel],
    [ROOM.bedConfiguration, row.bedConfiguration],
    [ROOM.notes, row.notes],
  );

function rooms(a: Answers["rooms"]): SectionAnswerLines {
  const groups = (a.rows ?? []).map((row, place) => ({
    key: row.rowId,
    heading: row.name ?? ROOM.row(place + 1),
    lines: roomLines(row),
  }));
  const lines = answered([ROOM.totalRooms, count(a.totalRooms)]);
  return { lines: [...lines, ...refreshNote(a.noLongerOffered)], groups: groupsOf(groups) };
}

type VenueRow = NonNullable<Answers["venues"]["rows"]>[number];

/** A venue's other layouts: each named with the guests it takes. */
function layoutsOf(layouts: VenueRow["otherLayouts"]): Text {
  const shown = (layouts ?? []).map((entry) => COPY.layout(entry.layout, layoutGuestsText(entry)));
  return shown.length === 0 ? null : COPY.joinLayouts(shown);
}

const venueLines = (row: VenueRow) =>
  answered(
    [VENUE.setting, choiceOf(row.setting, VENUE.settings)],
    [VENUE.venueType, choiceOf(row.venueType, VENUE.venueTypes)],
    [VENUE.area, areaOf(row.area)],
    [VENUE.seated, capacityText(row.seated)],
    [VENUE.floating, capacityText(row.floating)],
    [VENUE.theatre, count(row.theatre)],
    [VENUE.layouts, layoutsOf(row.otherLayouts)],
    [VENUE.lengthM, count(row.lengthM)],
    [VENUE.widthM, count(row.widthM)],
    [VENUE.ceilingHeightM, count(row.ceilingHeightM)],
    [VENUE.prefunctionArea, areaOf(row.prefunctionArea)],
    [VENUE.notes, row.notes],
  );

function venues(a: Answers["venues"]): SectionAnswerLines {
  const groups = (a.rows ?? []).map((row, place) => ({
    key: row.rowId,
    heading: row.name ?? VENUE.row(place + 1),
    lines: venueLines(row),
  }));
  const lines = answered([VENUE.totalEventSpace, areaOf(a.totalEventSpace)]);
  return { lines: [...lines, ...refreshNote(a.noLongerOffered)], groups: groupsOf(groups) };
}

function bookingTerms(a: Answers["booking_terms"]): SectionAnswerLines {
  const lines = answered(
    [BOOKING.buyout, choiceOf(a.weddingBuyoutPolicy, BUYOUT)],
    [BOOKING.minRooms, count(a.minRoomsWithoutBuyout)],
    [BOOKING.minNights, count(a.minNights)],
    [BOOKING.parallel, choiceOf(a.parallelFunctions, PARALLEL)],
    [BOOKING.notes, a.notes],
  );
  return { lines: [...lines, ...refreshNote(a.noLongerOffered)], groups: [] };
}

function foodBeverage(a: Answers["food_beverage"]): SectionAnswerLines {
  const lines = answered(
    [FOOD.cuisines, chipsOf(a.cuisines, HOTEL_CUISINE_OTHER, a.cuisinesOther)],
    [FOOD.cuisinesOther, a.cuisinesOther],
    [FOOD.facts.isPureVegetarian, yesNo(a.isPureVegetarian)],
    [FOOD.facts.hasSeparateVegKitchen, yesNo(a.hasSeparateVegKitchen)],
    [FOOD.facts.servesAlcohol, yesNo(a.servesAlcohol)],
  );
  return { lines: [...lines, ...refreshNote(a.noLongerOffered)], groups: [] };
}

function factSheet(a: Answers["fact_sheet_media"]): SectionAnswerLines {
  const lines = answered([FACT_SHEET.factSheetAsOf, a.factSheetAsOf]);
  return { lines: [...lines, ...refreshNote(a.noLongerOffered)], groups: [] };
}

const SECTIONS: {
  readonly [K in HotelFormSectionKey]: (answers: Answers[K]) => SectionAnswerLines;
} = {
  property,
  contact,
  rooms,
  venues,
  booking_terms: bookingTerms,
  food_beverage: foodBeverage,
  fact_sheet_media: factSheet,
};

/**
 * A section's answers in words: its own questions, then its rows, only what was answered.
 *
 * @example
 * answerLinesOf("rooms", draft.sections.rooms.answers).groups[0]?.heading; // "Lake View Suite"
 */
export function answerLinesOf<K extends HotelFormSectionKey>(
  key: K,
  answers: Answers[K],
): SectionAnswerLines {
  const lines: (answers: Answers[K]) => SectionAnswerLines = SECTIONS[key];
  return lines(answers);
}
