import {
  HOTEL_FACILITY_OTHER,
  hotelFormAccessPoint,
  hotelFormPropertyDraft,
  type HotelFormSectionAnswers,
} from "@ampm/core";

import {
  answerReader,
  booleanOf,
  fieldId,
  numberInput,
  numberText,
  textOf,
  yesNoOf,
  type AnswerReader,
  type YesNo,
} from "./field-values";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Property and location (plan §5.1: 1.1 to 1.6, 1.9, 1.10 and the new questions; D-190 §2): the fields as
 * the page holds them, and their reading through core's property draft.
 */

type Answers = HotelFormSectionAnswers["property"];

const SHAPE = hotelFormPropertyDraft.shape;
const ACCESS = hotelFormAccessPoint.unwrap().unwrap().shape;

/** A place a guest travels from, as typed: its name, the km and the drive in minutes. */
export interface AccessFields {
  readonly name: string;
  readonly km: string;
  readonly minutes: string;
}

/** The access points the section asks about, in its order. */
export const ACCESS_POINTS = ["airport", "railwayStation", "cityCentre"] as const;
export type AccessPoint = (typeof ACCESS_POINTS)[number];

export interface PropertyFields {
  readonly name: string;
  readonly isChain: YesNo;
  readonly groupName: string;
  readonly street: string;
  readonly locality: string;
  readonly city: string;
  /** One of core's INDIAN_STATES, or "" while none is chosen. */
  readonly state: string;
  readonly postalCode: string;
  readonly mapsUrl: string;
  readonly website: string;
  readonly airport: AccessFields;
  readonly railwayStation: AccessFields;
  readonly cityCentre: AccessFields;
  readonly accessNotes: string;
  /** One of core's HOTEL_STAR_CATEGORIES, or "". */
  readonly starCategory: string;
  readonly description: string;
  readonly facilities: readonly string[];
  readonly facilitiesOther: string;
  readonly noLongerOffered: string;
}

/** The property section's ids: a field's, and an access point part's. */
export const propertyId = (...parts: readonly string[]) => fieldId("property", ...parts);

function accessOf(point: Answers["airport"]): AccessFields {
  return {
    name: textOf(point?.name),
    km: numberText(point?.km),
    minutes: numberText(point?.minutes),
  };
}

function readAccess(
  reader: AnswerReader,
  key: AccessPoint,
  fields: AccessFields,
  saved: Answers["airport"],
): NonNullable<Answers["airport"]> {
  const id = (part: string) => propertyId(key, part);
  return {
    name: reader.read(id("name"), ACCESS.name, fields.name, saved?.name),
    km: reader.read(id("km"), ACCESS.km, numberInput(fields.km), saved?.km),
    minutes: reader.read(
      id("minutes"),
      ACCESS.minutes,
      numberInput(fields.minutes),
      saved?.minutes,
    ),
  };
}

function fieldsOf(answers: Answers): PropertyFields {
  return {
    name: textOf(answers.name),
    isChain: yesNoOf(answers.isChain),
    groupName: textOf(answers.groupName),
    street: textOf(answers.street),
    locality: textOf(answers.locality),
    city: textOf(answers.city),
    state: textOf(answers.state),
    postalCode: textOf(answers.postalCode),
    mapsUrl: textOf(answers.mapsUrl),
    website: textOf(answers.website),
    airport: accessOf(answers.airport),
    railwayStation: accessOf(answers.railwayStation),
    cityCentre: accessOf(answers.cityCentre),
    accessNotes: textOf(answers.accessNotes),
    starCategory: textOf(answers.starCategory),
    description: textOf(answers.description),
    facilities: answers.facilities ?? [],
    facilitiesOther: textOf(answers.facilitiesOther),
    noLongerOffered: textOf(answers.noLongerOffered),
  };
}

/** The address and the web: where the hotel is and how it is found. */
function readPlace(r: AnswerReader, fields: PropertyFields, saved: Answers) {
  return {
    street: r.read(propertyId("street"), SHAPE.street, fields.street, saved.street),
    locality: r.read(propertyId("locality"), SHAPE.locality, fields.locality, saved.locality),
    city: r.read(propertyId("city"), SHAPE.city, fields.city, saved.city),
    state: r.read(propertyId("state"), SHAPE.state, fields.state || null, saved.state),
    postalCode: r.read(
      propertyId("postalCode"),
      SHAPE.postalCode,
      fields.postalCode,
      saved.postalCode,
    ),
    mapsUrl: r.read(propertyId("mapsUrl"), SHAPE.mapsUrl, fields.mapsUrl, saved.mapsUrl),
    website: r.read(propertyId("website"), SHAPE.website, fields.website, saved.website),
  };
}

/** What the hotel is like: its access notes, stars, description and facilities. */
function readAbout(r: AnswerReader, fields: PropertyFields, saved: Answers) {
  return {
    accessNotes: r.read(
      propertyId("accessNotes"),
      SHAPE.accessNotes,
      fields.accessNotes,
      saved.accessNotes,
    ),
    starCategory: r.read(
      propertyId("starCategory"),
      SHAPE.starCategory,
      fields.starCategory || null,
      saved.starCategory,
    ),
    description: r.read(
      propertyId("description"),
      SHAPE.description,
      fields.description,
      saved.description,
    ),
    facilities: r.read(
      propertyId("facilities"),
      SHAPE.facilities,
      fields.facilities,
      saved.facilities,
    ),
    facilitiesOther: r.read(
      propertyId("facilitiesOther"),
      SHAPE.facilitiesOther,
      fields.facilities.includes(HOTEL_FACILITY_OTHER) ? fields.facilitiesOther : null,
      saved.facilitiesOther,
    ),
  };
}

function answersOf(fields: PropertyFields, saved: Answers): BuiltAnswers<"property"> {
  const r = answerReader();
  const isChain = booleanOf(fields.isChain);
  const answers: Answers = {
    name: r.read(propertyId("name"), SHAPE.name, fields.name, saved.name),
    isChain,
    // A group's name belongs to a chain only: answering No leaves it out (its words stay on the page).
    groupName:
      isChain === true
        ? r.read(propertyId("groupName"), SHAPE.groupName, fields.groupName, saved.groupName)
        : null,
    ...readPlace(r, fields, saved),
    airport: readAccess(r, "airport", fields.airport, saved.airport),
    railwayStation: readAccess(r, "railwayStation", fields.railwayStation, saved.railwayStation),
    cityCentre: readAccess(r, "cityCentre", fields.cityCentre, saved.cityCentre),
    ...readAbout(r, fields, saved),
    noLongerOffered: r.read(
      propertyId("noLongerOffered"),
      SHAPE.noLongerOffered,
      fields.noLongerOffered,
      saved.noLongerOffered,
    ),
  };
  return { answers, errors: r.errors };
}

/**
 * The property section's fields and their reading.
 *
 * @example
 * const fields = PROPERTY_MODEL.fieldsOf(draft.sections.property.answers, newKey);
 */
export const PROPERTY_MODEL: SectionModel<"property", PropertyFields> = { fieldsOf, answersOf };
