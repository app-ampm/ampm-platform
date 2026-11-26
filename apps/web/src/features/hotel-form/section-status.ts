import { HOTEL_FORM_SECTION_KEYS, type HotelFormDraftSections } from "@ampm/core";

/*
 * A section's status as the overview and the review show it (D-190 §5): not started until its first save,
 * then in progress or complete (core's completeness, stored on every save), or No changes on a refresh.
 * The fact sheet section counts as complete until its uploads arrive (Slice 9), but shows Not started
 * until something in it is saved, so the person is not told it is done when they have not opened it.
 */

export type SectionStatus = "not_started" | "in_progress" | "complete" | "no_changes";

interface SectionState {
  readonly version: number;
  readonly isComplete: boolean;
  readonly noChanges: boolean;
}

/**
 * The status a section shows.
 *
 * @example
 * sectionStatusOf(draft.sections.rooms); // "in_progress"
 */
export function sectionStatusOf(section: SectionState): SectionStatus {
  if (section.noChanges) return "no_changes";
  if (section.version === 0) return "not_started";
  return section.isComplete ? "complete" : "in_progress";
}

/**
 * How many sections are done: complete, or marked No changes.
 *
 * @example
 * doneSectionsOf(draft.sections); // 3
 */
export function doneSectionsOf(sections: HotelFormDraftSections): number {
  return HOTEL_FORM_SECTION_KEYS.filter((key) => {
    const status = sectionStatusOf(sections[key]);
    return status === "complete" || status === "no_changes";
  }).length;
}
