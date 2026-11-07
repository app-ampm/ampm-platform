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
    // With nothing queued yet, "They" has nothing to refer to.
    idleDescription: "Changes you make sync when signal returns.",
  },
  internalPanel: {
    label: "Internal · never sent to clients",
  },
  screenHeader: {
    back: "Back",
  },
  stat: {
    summary: (label: string, value: string, caption?: string) =>
      caption ? `${label}: ${value} ${caption}` : `${label}: ${value}`,
  },
  avatar: {
    overflow: (count: number) => `+${count}`,
    group: (names: readonly string[], more: number) =>
      (more > 0 ? [...names, `${more} more`] : names).join(", "),
  },
  tabBar: {
    label: "Main navigation",
    locked: "Locked",
    badge: (count: number) => `${count} waiting`,
  },
  navRail: {
    label: "Workspace navigation",
    collapse: "Collapse navigation",
    expand: "Expand navigation",
    badge: (count: number) => `${count} waiting`,
  },
  otp: {
    // One labelled field: the cells are drawn for sight and hidden from screen readers.
    label: "Verification code",
  },
  stepper: {
    done: "done",
    current: "current step",
    upcoming: "not started",
  },
  progress: {
    label: "Progress",
    steps: (filled: number, total: number) => `${filled} of ${total}`,
  },
  photo: {
    placeholder: "Photo",
  },
  moneyText: {
    // Spoken form of "₹16,000–24,000": screen readers read an en dash inconsistently.
    range: (low: string, high: string) => `${low} to ${high}`,
  },
  badge: {
    capped: (max: number) => `${max}+`,
    cappedSpoken: (max: number) => `More than ${max}`,
  },
  filterChip: {
    withCount: (label: string, count: number) => `${label} · ${count}`,
    spokenWithCount: (label: string, count: number) => `${label}, ${count}`,
  },
  segmentedControl: {
    // "Waiting · 4" (P7, C4); screen readers hear "Waiting, 4" instead of the middle dot.
    withBadge: (label: string, badge: number | string) => `${label} · ${badge}`,
    spokenWithBadge: (label: string, badge: number | string) => `${label}, ${badge}`,
  },
  queryError: {
    // A session that has ended; screens name what the sign-in is for ("Sign in to view leads").
    signIn: {
      title: "Sign in to continue",
      action: "Sign in",
    },
  },
} as const;
