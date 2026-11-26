import type { HotelFormRequestStatus } from "@ampm/core";

/*
 * The words of HF-07, the request's status (D-190 §5; plan §4.4, §8 and §9.3), in one place until the
 * public site's i18n arrives: where the request stands, the correction, withdrawing 7.5, and removing the
 * person's details. The API's refusals are shown as the API words them (HOTEL_FORM_ERRORS). Nothing here
 * names a hotel.
 */

interface StatusWords {
  readonly title: string;
  readonly emphasis: string;
  readonly body: string;
}

export const STATUS_COPY = {
  loading: "Loading your request…",
  failed: "We couldn't load your request.",
  /** Each status in plain words: the page's heading, and what it means for the person. */
  status: {
    open: {
      title: "Not submitted",
      emphasis: "yet.",
      body: "Nothing has been sent to AMPM yet. Fill in the sections, then review and submit the form.",
    },
    changes_requested: {
      title: "AMPM asked for",
      emphasis: "some changes.",
      body: "Read AMPM's note on the overview, update the sections it mentions, then review and submit the form again.",
    },
    submitted: {
      title: "Your answers are",
      emphasis: "with AMPM.",
      body: "AMPM's Hotel team has your answers and will review them. They can't be changed here now: if something is wrong, ask for a correction.",
    },
    in_review: {
      title: "AMPM is reviewing",
      emphasis: "your answers.",
      body: "AMPM's Hotel team is reviewing your answers. They can't be changed here now: if something is wrong, ask for a correction.",
    },
    merged: {
      title: "This request is",
      emphasis: "complete.",
      body: "AMPM has added your answers to its records. Until this link stops working you can still ask for a correction here.",
    },
  } satisfies Readonly<Record<HotelFormRequestStatus, StatusWords>>,
  referenceLabel: "Reference",
  submittedBy: (name: string, moment: string) => `Submitted by ${name} ${moment}.`,
  /** Who submitted withdrew their consent: never named. */
  submittedAt: (moment: string) => `Submitted ${moment}.`,
  update: "Update your answers",
  back: "Back to the overview",
  afterSubmit:
    "After the form is submitted, you can ask AMPM for a correction here, withdraw your consent, or ask AMPM to remove your details.",
  correction: {
    heading: "Request a correction",
    lead: "Something wrong or missing since the form was submitted? Tell AMPM's Hotel team what should change. Only AMPM's staff read your message.",
    field: "What should be corrected?",
    count: (count: number, max: number) => `${count} of ${max} characters`,
    send: "Send to AMPM",
    sending: "Sending…",
    sent: "Sent to AMPM's Hotel team. You can send another if something else needs correcting.",
    waitingForCheck:
      "The security check hasn't finished yet. Wait a moment for it, then send again.",
    newCode:
      "Enter a new code above, then send again. Your message is kept if you sign in as yourself; for anyone else it is cleared.",
    waitLeft: (time: string) => `You can send again in ${time}.`,
    botCheck: {
      checking: "Running a quick security check before you send…",
      passed: "Security check passed. You can send your message.",
      failed: "The security check did not finish. Check your connection, then try again.",
      unsupported: "This browser cannot run our security check. Please try another browser.",
      retry: "Try the check again",
    },
  },
  consent: {
    heading: "Your consent and your details",
    newCode: "Enter a new code above, then try again.",
    display: {
      heading: "Showing your hotel's photographs",
      body: "A Yes, given when the form was submitted, to “May AMPM show your hotel's details to its clients?” lets AMPM show its clients the photographs it has approved. You can withdraw that permission here; AMPM is told at once.",
      withdraw: "Withdraw my permission to show photos",
      withdrawing: "Withdrawing…",
      done: "Your permission to show photos is withdrawn, and AMPM has been told.",
      none: "You have no permission to show photos on record, so nothing changed.",
    },
    removal: {
      heading: "Remove my details",
      body: "Withdraw every consent you gave on this form and ask AMPM to remove your name, designation and mobile from this request.",
      start: "Remove my details",
      confirmHeading: "Remove your details?",
      next: "What happens next:",
      steps: [
        "Every consent you gave on this form is withdrawn, the privacy notice's included.",
        "You are signed out, here and on any other device where you opened this link.",
        "Your colleagues no longer see your name on the form.",
        "A Super Admin at AMPM reviews your request and removes your details. The hotel's answers stay with AMPM.",
        "To help with the form again, you would enter a new code and accept the privacy notice again.",
      ],
      confirm: "Yes, remove my details",
      removing: "Removing…",
      cancel: "Cancel",
    },
  },
  removed: {
    eyebrow: "Hotel information form",
    title: "Your consent is",
    emphasis: "withdrawn.",
    body: "AMPM has your request to remove your details from this request, and a Super Admin will review it. You are signed out on every device.",
  },
} as const;
