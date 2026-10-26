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

/**
 * Step 3 of the pipeline (architecture §6): the modules a client principal may reach, from
 * subscription, agreements and memberships combined (permission-matrix §3). Computed per request
 * and cached by the API for at most five minutes.
 */
export function resolveClientEntitlements(state: ClientAccountState): Entitlements {
  if (state.suspended) return { modules: [], readOnly: true, signInRefused: true };
  const modules = new Set<EntitlementModule>(["support"]);
  let readOnly = false;
  if (state.isDemo) {
    for (const m of [
      "hotel_discovery",
      "saved_hotels",
      "hotel_assistance",
      "wedding_workspace",
      "guests_rsvp",
      "menus",
      "live_chat",
    ] as const)
      modules.add(m);
    return { modules: [...modules], readOnly: true, signInRefused: false };
  }
  if (state.subscription === "active") {
    modules.add("hotel_discovery");
    modules.add("saved_hotels");
    modules.add("hotel_assistance");
  } else if (
    state.subscription === "expired" ||
    state.subscription === "cancelled" ||
    state.subscription === "suspended"
  ) {
    modules.add("saved_hotels");
    modules.add("hotel_assistance");
    modules.add("client_finance");
    readOnly = true;
  }
  if (state.hotelAssistanceAgreement) {
    modules.add("hotel_discovery");
    modules.add("saved_hotels");
    modules.add("hotel_assistance");
    modules.add("client_finance");
  }
  if (state.project !== "none" && state.project !== "archived") {
    for (const m of [
      "saved_hotels",
      "hotel_assistance",
      "wedding_workspace",
      "guests_rsvp",
      "menus",
      "live_chat",
    ] as const)
      modules.add(m);
    if (state.project === "on_hold" || state.project === "closed_in_window") readOnly = true;
  }
  return { modules: [...modules], readOnly, signInRefused: false };
}
