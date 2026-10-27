/**
 * The UI package's default copy, in one place. The apps replace it through their i18n layer when
 * i18next lands (sprint 2); until then every component takes the same strings as props, and these are
 * only the fallbacks. No other file in packages/ui holds user-facing text.
 */
export const uiCopy = {
  close: "Close",
  dismiss: "Dismiss",
  retry: "Try again",
  required: "required",
  callout: {
    indicative: "Indicative",
    requested: "Requested",
    verified: "Verified",
    "awaiting-confirmation": "Awaiting confirmation",
    offline: "You are offline",
    "pending-sync": "Changes pending sync",
    info: "Note",
    success: "Done",
    warning: "Check this",
    danger: "Something needs attention",
  },
  offline: {
    title: "You are offline",
    description:
      "What you see may be out of date. Changes you make are kept and sent when you are back online.",
  },
  error: {
    title: "Something went wrong",
    description: "Please try again. If it keeps happening, tell the AMPM team.",
  },
} as const;
