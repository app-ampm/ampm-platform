import type {
  HotelVenueSetting,
  HotelVenueType,
  VenueCreateRequest,
  VenueUpdateRequest,
  VenueView,
} from "@ampm/core";

import { areaBody, areaErrors, PREFUNCTION_AREA, VENUE_AREA } from "./hotel-area.form";
import {
  changedEntries,
  intOrNull,
  linesToList,
  listToLines,
  numberOrNull,
  numberRuleError,
  numberToText,
  textOrNull,
  type NumberRule,
} from "./hotel-form-fields";
import { CAPACITY_LABEL } from "./subresources.format";
import {
  layoutDraftsFrom,
  layoutsBody,
  layoutsError,
  type LayoutDraft,
} from "./venue-layouts.form";

/*
 * The venue editor's form logic (TW-22; D-178), pure so it is tested without rendering: the draft (text
 * as strings), the checks that must pass before a save, and the create body and an update's changed
 * part. A new venue starts with no setting, so staff say where it is rather than accept a default; the
 * server derives `is_indoor` from it and re-validates every bound.
 */

/** A venue's setting as the picker holds it: one of core's, or "unset" until a new venue's is chosen. */
export type SettingChoice = HotelVenueSetting | "unset";

export interface VenueDraft {
  readonly name: string;
  readonly venueType: HotelVenueType;
  readonly setting: SettingChoice;
  readonly areaSqm: string;
  readonly areaSqft: string;
  readonly lengthM: string;
  readonly widthM: string;
  readonly ceilingHeightM: string;
  readonly capacityBanquet: string;
  readonly capacityTheatre: string;
  readonly capacityReception: string;
  readonly capacityNotes: string;
  readonly otherLayouts: readonly LayoutDraft[];
  readonly prefunctionAreaSqm: string;
  readonly prefunctionAreaSqft: string;
  /** One per line, as the import's list rule reads them (a comma stays inside an entry). */
  readonly facilities: string;
  readonly description: string;
}

/** A draft whose setting is chosen: what a save sends. */
export type ValidVenueDraft = VenueDraft & { readonly setting: HotelVenueSetting };

/** Whether the draft's setting is chosen, so it can be sent. */
export function hasSetting(draft: VenueDraft): draft is ValidVenueDraft {
  return draft.setting !== "unset";
}

export function draftFromVenue(venue: VenueView | null): VenueDraft {
  return {
    name: venue?.name ?? "",
    venueType: venue?.venueType ?? "ballroom",
    setting: venue?.setting ?? "unset",
    areaSqm: numberToText(venue?.areaSqm ?? null),
    areaSqft: numberToText(venue?.areaSqft ?? null),
    lengthM: numberToText(venue?.lengthM ?? null),
    widthM: numberToText(venue?.widthM ?? null),
    ceilingHeightM: numberToText(venue?.ceilingHeightM ?? null),
    capacityBanquet: numberToText(venue?.capacityBanquet ?? null),
    capacityTheatre: numberToText(venue?.capacityTheatre ?? null),
    capacityReception: numberToText(venue?.capacityReception ?? null),
    capacityNotes: venue?.capacityNotes ?? "",
    otherLayouts: layoutDraftsFrom(venue?.otherLayouts ?? null),
    prefunctionAreaSqm: numberToText(venue?.prefunctionAreaSqm ?? null),
    prefunctionAreaSqft: numberToText(venue?.prefunctionAreaSqft ?? null),
    facilities: listToLines(venue?.facilities ?? null),
    description: venue?.description ?? "",
  };
}

/** The fields the checks name, in the order the editor shows them (a blocked save focuses the first). */
export const VENUE_FIELD_ORDER = [
  "name",
  "setting",
  "areaSqm",
  "areaSqft",
  "lengthM",
  "widthM",
  "ceilingHeightM",
  "capacityBanquet",
  "capacityTheatre",
  "capacityReception",
  "otherLayouts",
  "prefunctionAreaSqm",
  "prefunctionAreaSqft",
] as const satisfies readonly (keyof VenueDraft)[];
export type VenueField = (typeof VENUE_FIELD_ORDER)[number];

/** Each checked field's label as the editor shows it. */
export const VENUE_FIELD_LABEL: Readonly<Record<VenueField, string>> = {
  name: "Name",
  setting: "Setting",
  areaSqm: "Area (m²)",
  areaSqft: "Area (sq ft)",
  lengthM: "Length (m)",
  widthM: "Width (m)",
  ceilingHeightM: "Ceiling height (m)",
  ...CAPACITY_LABEL,
  otherLayouts: "Other layouts",
  prefunctionAreaSqm: "Pre-function area (m²)",
  prefunctionAreaSqft: "Pre-function area (sq ft)",
};

export type VenueErrors = Readonly<Record<VenueField, string | undefined>>;

function metres(max: number, name: string): NumberRule {
  const upTo = max.toLocaleString("en-IN");
  return {
    min: 0,
    max,
    places: 2,
    message: `${name} is in metres, up to ${upTo}, to two decimals`,
  };
}

function guests(name: string): NumberRule {
  return { min: 0, max: 100_000, places: 0, message: `${name} is a whole number, up to 100,000` };
}

const RULES = {
  lengthM: metres(2_000, "Length"),
  widthM: metres(2_000, "Width"),
  ceilingHeightM: metres(100, "Ceiling height"),
  capacityBanquet: guests("Seated"),
  capacityTheatre: guests("Theatre"),
  capacityReception: guests("Floating"),
} satisfies Readonly<Partial<Record<VenueField, NumberRule>>>;

export function validateVenue(draft: VenueDraft): VenueErrors {
  const area = areaErrors(draft.areaSqm, draft.areaSqft, VENUE_AREA);
  const prefunction = areaErrors(
    draft.prefunctionAreaSqm,
    draft.prefunctionAreaSqft,
    PREFUNCTION_AREA,
  );
  return {
    name: draft.name.trim() === "" ? "Give the venue a name" : undefined,
    setting: hasSetting(draft) ? undefined : "Choose the venue's setting",
    areaSqm: area.sqm,
    areaSqft: area.sqft,
    lengthM: numberRuleError(draft.lengthM, RULES.lengthM),
    widthM: numberRuleError(draft.widthM, RULES.widthM),
    ceilingHeightM: numberRuleError(draft.ceilingHeightM, RULES.ceilingHeightM),
    capacityBanquet: numberRuleError(draft.capacityBanquet, RULES.capacityBanquet),
    capacityTheatre: numberRuleError(draft.capacityTheatre, RULES.capacityTheatre),
    capacityReception: numberRuleError(draft.capacityReception, RULES.capacityReception),
    otherLayouts: layoutsError(draft.otherLayouts),
    prefunctionAreaSqm: prefunction.sqm,
    prefunctionAreaSqft: prefunction.sqft,
  };
}

/**
 * The create body from a valid draft: trimmed text or null, the m² of each area worked out from a
 * filled sq ft, the filled layout rows (null when none), facilities one per line.
 */
export function buildVenueBody(draft: ValidVenueDraft): VenueCreateRequest {
  const area = areaBody(draft.areaSqm, draft.areaSqft);
  const prefunction = areaBody(draft.prefunctionAreaSqm, draft.prefunctionAreaSqft);
  return {
    name: draft.name.trim(),
    venueType: draft.venueType,
    setting: draft.setting,
    areaSqm: area.sqm,
    areaSqft: area.sqft,
    lengthM: numberOrNull(draft.lengthM),
    widthM: numberOrNull(draft.widthM),
    ceilingHeightM: numberOrNull(draft.ceilingHeightM),
    capacityBanquet: intOrNull(draft.capacityBanquet),
    capacityTheatre: intOrNull(draft.capacityTheatre),
    capacityReception: intOrNull(draft.capacityReception),
    capacityNotes: textOrNull(draft.capacityNotes),
    otherLayouts: layoutsBody(draft.otherLayouts),
    prefunctionAreaSqm: prefunction.sqm,
    prefunctionAreaSqft: prefunction.sqft,
    facilities: linesToList(draft.facilities),
    description: textOrNull(draft.description),
  };
}

/**
 * An update's body: only what the draft changes from the venue as the sheet opened it, so a save never
 * writes back a value an import changed meanwhile. Empty when nothing changed.
 *
 * @example
 * venueUpdateBody({ ...opened, capacityTheatre: "420" }, venue); // { capacityTheatre: 420 }
 */
export function venueUpdateBody(draft: ValidVenueDraft, venue: VenueView): VenueUpdateRequest {
  const opened: ValidVenueDraft = { ...draftFromVenue(venue), setting: venue.setting };
  return changedEntries(buildVenueBody(draft), buildVenueBody(opened));
}
