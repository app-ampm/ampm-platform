import type { HotelFormSectionKey } from "@ampm/core";

/*
 * The words around HF-05's sections (D-190 §5; plan §4.4 and §8): each section's title and lead, its
 * status, the save line, a colleague's save, a locked request, the refresh questions and the way between
 * sections. The questions themselves are in sections/section-fields-copy.ts. In one place until the
 * public site's i18n arrives.
 */

/** A section's title on its page, the overview and the review, and the line under its title. */
export const SECTION_TITLES: Readonly<
  Record<HotelFormSectionKey, { readonly title: string; readonly lead: string }>
> = {
  property: {
    title: "Property and location",
    lead: "Where the hotel is, how guests reach it, and what it offers.",
  },
  contact: {
    title: "Contact for weddings and events",
    lead: "Who AMPM's planners should speak to about a wedding or an event: up to 3 people.",
  },
  rooms: {
    title: "Rooms",
    lead: "Each kind of room, suite, villa or tent the hotel offers, and how many there are.",
  },
  venues: {
    title: "Venues",
    lead: "Each space a wedding function can use: halls, lawns, terraces, poolsides and more.",
  },
  booking_terms: {
    title: "Booking terms",
    lead: "What a wedding needs to book the hotel. AMPM keeps these to itself: couples never see them.",
  },
  food_beverage: {
    title: "Food and beverage",
    lead: "What your kitchens cook, and a few facts about food and drink. Menus are uploaded with the fact sheet soon.",
  },
  fact_sheet_media: {
    title: "Fact sheet, photos and floor plans",
    lead: "When your fact sheet was last updated. Uploads for the fact sheet, menus, photos and floor plans open here soon.",
  },
};

export const SECTIONS_COPY = {
  eyebrow: (number: number, of: number) => `Section ${number} of ${of}`,
  loading: "Loading this section…",
  failed: "We couldn't load this section.",
  status: {
    not_started: "Not started",
    in_progress: "In progress",
    complete: "Complete",
    no_changes: "No changes",
  },
  requiredToSubmit: "Needed before you submit",
  refresh: {
    lead: "Fill in only what changed; blanks leave our records unchanged.",
    noChanges: "No changes since last time",
    noChangesOn:
      "Marked as no changes since last time. Untick it to fill in what changed, and AMPM reads your answers instead.",
    noLongerOffered: "Anything no longer offered or renamed?",
    noLongerOfferedHelp: "For example a restaurant that closed, or a hall with a new name.",
  },
  save: {
    idle: "Your answers save as you type.",
    saving: "Saving…",
    saved: "Saved",
    notSaved: "Not saved –",
    held: "Not saved yet",
    retry: "Retry",
    retryIn: (time: string) => `trying again in ${time}`,
    fixMarked: "Saved, except the answers marked below. Correct them and they save too.",
    session: "Not saved – enter a new code above to carry on. Your answers stay on this page.",
  },
  conflict: {
    heading: (time: string, day: string) => `A colleague saved this section at ${time} on ${day}`,
    body: (name: string) =>
      `${name} saved it after you opened it. Keep mine saves what is on this page over their answers; Take theirs replaces what is on this page with their answers.`,
    /** A colleague who withdrew their consent is never named. */
    bodyUnnamed:
      "A colleague saved it after you opened it. Keep mine saves what is on this page over their answers; Take theirs replaces what is on this page with their answers.",
    keepMine: "Keep mine",
    takeTheirs: "Take theirs",
  },
  locked: {
    heading: "This form was submitted",
    refused: (name: string, moment: string) =>
      `${name} submitted the form ${moment}, so your last changes here were not saved. They are still on this page, so you can copy them into a correction for AMPM.`,
    refusedPlain:
      "The form was submitted, so your last changes here were not saved. They are still on this page, so you can copy them into a correction for AMPM.",
    readOnly: "The answers can't be changed here now.",
    status: "See where your request stands",
  },
  nav: {
    label: "Sections",
    back: "Back to the overview",
    next: (title: string) => `Next: ${title}`,
    review: "Review and submit",
  },
} as const;
