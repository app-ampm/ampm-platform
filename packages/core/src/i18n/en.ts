/** The `en` namespace, first language (standards: i18next, guest portal translation-ready). */
export const en = {
  errors: {
    validation_failed: "Some of the information is not valid.",
    unauthenticated: "Sign in to continue.",
    forbidden: "You cannot do that.",
    not_found: "We could not find that.",
    conflict: "That change is not possible right now.",
    rate_limited: "Too many attempts. Please wait a moment.",
    internal: "Something went wrong on our side.",
    unavailable: "The service is not available right now.",
    network_error: "Could not reach the server. Check your connection.",
  },
  common: {
    retry: "Try again",
    close: "Close",
    dismiss: "Dismiss",
  },
} as const;
