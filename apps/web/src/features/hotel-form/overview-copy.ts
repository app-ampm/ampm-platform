/*
 * The words of HF-04, the overview (D-190 §5; plan §4.4 and §8), in one place until the public site's i18n
 * arrives. Nothing here names a hotel: the page shows only AMPM's label and note, the request's status,
 * and the names and designations of the people helping. The sections' own words are in sections-copy.ts.
 */

export const OVERVIEW_COPY = {
  loading: "Loading your request…",
  quickStart: {
    heading: "Quick start",
    body: "Have a fact sheet or menus to hand? Start with the fact sheet section: uploads for your fact sheet, menus, photos and floor plans open there soon, and the dates they need are asked there now.",
    link: "Go to the fact sheet section",
  },
  sections: {
    heading: "Your form",
    progress: (done: number, all: number) => `${done} of ${all} sections complete`,
    lastSaved: (name: string, moment: string) => `Last saved by ${name} ${moment}`,
    loading: "Loading your sections…",
    failed: "We couldn't load your sections.",
  },
  helpers: {
    heading: "Who is helping",
    you: (name: string) => `${name} (you)`,
    person: (name: string, designation: string) => `${name} · ${designation}`,
    onlyYou:
      "Only you so far. Colleagues can help: share this link with them, and each signs in with their own mobile.",
  },
  changesRequested: {
    heading: "AMPM asked for some changes",
    body: "Read AMPM's note, update the sections it mentions, then review and submit the form again.",
  },
  locked: {
    heading: "Your answers are with AMPM",
    submitted: (name: string, moment: string) =>
      `${name} submitted this form ${moment}. AMPM is reviewing it, so the answers can't be changed here.`,
    submittedPlain:
      "This form was submitted. AMPM is reviewing it, so the answers can't be changed here.",
  },
  complete: {
    heading: "This request is complete",
    body: "AMPM has your hotel's information. You can still see where the request stands.",
  },
  review: "Review and submit",
  status: "See where your request stands",
} as const;
