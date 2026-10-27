import type { EntitlementModule } from "@ampm/core";

/** A client account's state, the rows of permission-matrix §3. */
export interface ClientAccountState {
  readonly isDemo: boolean;
  readonly suspended: boolean;
  readonly subscription: "none" | "active" | "expired" | "cancelled" | "suspended" | "trial";
  readonly hotelAssistanceAgreement: boolean;
  /** The strongest membership the principal holds. */
  readonly project: "none" | "active" | "on_hold" | "closed_in_window" | "archived";
}

export interface Entitlements {
  readonly modules: readonly EntitlementModule[];
  readonly readOnly: boolean;
  readonly signInRefused: boolean;
}

const DEMO_MODULES: readonly EntitlementModule[] = [
  "hotel_discovery",
  "saved_hotels",
  "hotel_assistance",
  "wedding_workspace",
  "guests_rsvp",
  "menus",
  "live_chat",
];
const ACTIVE_SUBSCRIPTION: readonly EntitlementModule[] = [
  "hotel_discovery",
  "saved_hotels",
  "hotel_assistance",
];
/** A lapsed subscription keeps its records readable, finance included, but reaches nothing new. */
const LAPSED_SUBSCRIPTION: readonly EntitlementModule[] = [
  "saved_hotels",
  "hotel_assistance",
  "client_finance",
];
const LAPSED = new Set<ClientAccountState["subscription"]>(["expired", "cancelled", "suspended"]);
const AGREEMENT_MODULES: readonly EntitlementModule[] = [
  "hotel_discovery",
  "saved_hotels",
  "hotel_assistance",
  "client_finance",
];
const PROJECT_MODULES: readonly EntitlementModule[] = [
  "saved_hotels",
  "hotel_assistance",
  "wedding_workspace",
  "guests_rsvp",
  "menus",
  "live_chat",
];
const READ_ONLY_PROJECT = new Set<ClientAccountState["project"]>(["on_hold", "closed_in_window"]);

function subscriptionModules(
  subscription: ClientAccountState["subscription"],
): readonly EntitlementModule[] {
  if (subscription === "active") return ACTIVE_SUBSCRIPTION;
  return LAPSED.has(subscription) ? LAPSED_SUBSCRIPTION : [];
}

/**
 * Step 3 of the pipeline (architecture §6): the modules a client principal may reach, from
 * subscription, agreements and memberships combined (permission-matrix §3). Computed per request
 * and cached by the API for at most five minutes.
 */
export function resolveClientEntitlements(state: ClientAccountState): Entitlements {
  if (state.suspended) return { modules: [], readOnly: true, signInRefused: true };
  if (state.isDemo) {
    return { modules: ["support", ...DEMO_MODULES], readOnly: true, signInRefused: false };
  }
  const hasProject = state.project !== "none" && state.project !== "archived";
  const modules = new Set<EntitlementModule>([
    "support",
    ...subscriptionModules(state.subscription),
    ...(state.hotelAssistanceAgreement ? AGREEMENT_MODULES : []),
    ...(hasProject ? PROJECT_MODULES : []),
  ]);
  const readOnly =
    LAPSED.has(state.subscription) || (hasProject && READ_ONLY_PROJECT.has(state.project));
  return { modules: [...modules], readOnly, signInRefused: false };
}
