/*
 * The words of the hotel's answers read back (D-190 §5): the summary on HF-06 with its Edit links, and the
 * read-only answers on HF-07. The questions keep the words their sections ask them in
 * (sections/section-fields-copy.ts); these are the summary's own. In one place until the public site's
 * i18n arrives.
 */

export const ANSWERS_COPY = {
  heading: "Your answers",
  edit: "Edit",
  nothingYet: "Nothing answered yet.",
  noChanges: "Marked as no changes since last time.",
  /** A section a colleague saved after the review page read it (409 sectionsChanged). */
  changed: "Changed by a colleague",
  changedLine:
    "A colleague saved this section while you were reviewing. Check it before you submit.",
  km: (km: number) => `${km} km`,
  minutes: (minutes: number) => `${minutes} min`,
  layout: (name: string, guests: string) => (guests === "" ? name : `${name}: ${guests}`),
  joinParts: (parts: readonly string[]) => parts.join(" · "),
  joinChoices: (choices: readonly string[]) => choices.join(", "),
  joinLayouts: (layouts: readonly string[]) => layouts.join("; "),
} as const;
