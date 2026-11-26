/*
 * The words of HF-06, Review and submit (D-190 §5; plan §4.4 and §8), in one place until the public site's
 * i18n arrives. 7.4's and 7.5's own words are core's (HOTEL_FORM_ACCURACY_DECLARATION and
 * HOTEL_FORM_DISPLAY_AUTHORISATION, a draft for counsel, HF-G2), and the API's refusals are shown as the
 * API words them (HOTEL_FORM_ERRORS). Nothing here names a hotel.
 */

export const REVIEW_COPY = {
  eyebrow: "Last step",
  title: "Review and",
  emphasis: "submit.",
  lead: "Check each section's answers. Edit a section to change it, then come back here to submit the form to AMPM.",
  loading: "Loading your answers…",
  failed: "We couldn't load your answers.",
  /** Sections a colleague saved while the page was open, kept as the page showed them (fix C1). */
  changed: {
    heading: "A colleague changed some answers while you were reviewing",
    announce: (sections: string) =>
      `A colleague changed ${sections} while you were reviewing. Show the latest answers before you submit.`,
    body: "The sections marked below still show the answers this page opened with. Show the latest answers to see what changed: your choices under Before you submit are kept.",
    showLatest: "Show the latest answers",
    /** "Rooms", "Rooms and Venues", "Rooms, Venues and Booking terms". */
    sections: (titles: readonly string[]) =>
      titles.length < 2
        ? titles.join("")
        : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`,
  },
  colleagues: {
    heading: "A colleague saved some answers a moment ago",
    named: (name: string, section: string, time: string) => `${name} saved ${section} at ${time}.`,
    /** A colleague who withdrew their consent is never named. */
    unnamed: (section: string, time: string) => `A colleague saved ${section} at ${time}.`,
    body: "Check their answers below before you submit: submitting confirms every answer in the form.",
  },
  missing: {
    heading: "Needed before you submit",
    none: "Everything needed to submit is answered.",
    where: (section: string, place: string | null) =>
      place === null ? section : `${section} · ${place}`,
    item: (where: string, message: string) => `${where}: ${message}`,
    layout: (venue: string, layout: string) => `${venue} · ${layout}`,
  },
  incomplete: {
    heading: "Sections not complete",
    body: "You can submit without these, but AMPM's planners may ask you for the rest later.",
  },
  declarations: {
    heading: "Before you submit",
  },
  botCheck: {
    checking: "Running a quick security check before you submit…",
    passed: "Security check passed. You can submit.",
    failed: "The security check did not finish. Check your connection, then try again.",
    unsupported: "This browser cannot run our security check. Please try another browser.",
    retry: "Try the check again",
  },
  submit: "Submit to AMPM",
  submitting: "Submitting…",
  waitingForCheck:
    "The security check hasn't finished yet. Wait a moment for it, then submit again.",
  newCode: "Enter a new code above, then submit again. Your answers and choices here are kept.",
  waitLeft: (time: string) => `You can submit again in ${time}.`,
  back: "Back to the overview",
} as const;
