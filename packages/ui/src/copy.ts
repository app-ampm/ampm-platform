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
  // Peacock Night components. Each component owns its section; strings are fallbacks for props.
  offlineBanner: {
    title: "Offline",
    queued: (count: number) => (count === 1 ? "1 update queued" : `${count} updates queued`),
    description: "They sync when signal returns.",
  },
  internalPanel: {
    label: "Internal · never sent to clients",
  },
  screenHeader: {
    back: "Back",
  },
  tabBar: {
    label: "Main navigation",
    locked: "Locked",
  },
  navRail: {
    label: "Workspace navigation",
    collapse: "Collapse navigation",
    expand: "Expand navigation",
  },
  otp: {
    label: "Verification code",
    digit: (position: number, length: number) => `Digit ${position} of ${length}`,
  },
  stepper: {
    done: "done",
    current: "current step",
    upcoming: "not started",
  },
  progress: {
    label: "Progress",
  },
  photo: {
    placeholder: "Photo",
  },
} as const;
