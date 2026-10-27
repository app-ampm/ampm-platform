import { entitlementModule, type EntitlementModule } from "@ampm/core";

/** A client account's state, the rows of permission-matrix §3. */
export interface ClientAccountState {
  readonly isDemo: boolean;
  readonly suspended: boolean;
  readonly subscription: "none" | "active" | "expired" | "cancelled" | "suspended" | "trial";
  readonly hotelAssistanceAgreement: boolean;
  /** The strongest membership the principal holds. */
  readonly project: "none" | "active" | "on_hold" | "closed_in_window" | "archived";
}

/**
 * Which hotels the hotel_discovery module reaches (§3, first column): full search with an active
 * subscription, otherwise the project's, the agreement's or the demo set's hotels only.
 *
 * @example
 * const searchAll = entitlements.hotelReach.includes("all_hotels");
 */
export type HotelReach = "all_hotels" | "project_hotels" | "agreement_hotels" | "demo_hotels";

/**
 * Which records the client_finance module reaches (§3, finance column): a lapsed subscription the
 * account's own invoices and payments (line 97), an agreement the invoices of that service
 * (line 98), the demo its sample (line 94). A wedding's finance waits for AMPM (Q4, line 99), so
 * no source reaches it, and a module listed without a reach shows nothing.
 *
 * @example
 * if (!entitlements.financeReach.includes("own_invoices")) throw errors.notFound();
 */
export type FinanceReach = "own_invoices" | "agreement_invoices" | "demo_sample";

/**
 * What a client principal may reach, and how far.
 *
 * @example
 * const writable = entitlements.modules.filter((m) => !entitlements.readOnlyModules.includes(m));
 */
export interface Entitlements {
  readonly modules: readonly EntitlementModule[];
  /** Modules the principal may read but not change: a downgrade is read-only first (§3). */
  readonly readOnlyModules: readonly EntitlementModule[];
  readonly hotelReach: readonly HotelReach[];
  readonly financeReach: readonly FinanceReach[];
  readonly signInRefused: boolean;
}

type Access = "read" | "write";

/** One row of §3: what it opens, and how far. */
interface Source {
  readonly modules: Readonly<Partial<Record<EntitlementModule, Access>>>;
  readonly hotels: HotelReach | null;
  readonly finance: FinanceReach | null;
}

const HOTEL_ORDER: readonly HotelReach[] = [
  "all_hotels",
  "project_hotels",
  "agreement_hotels",
  "demo_hotels",
];
const FINANCE_ORDER: readonly FinanceReach[] = [
  "own_invoices",
  "agreement_invoices",
  "demo_sample",
];

/** §3 line 94: sample data to read; saving hotels and asking for assistance go to Sales. */
const DEMO: Source = {
  modules: {
    hotel_discovery: "read",
    saved_hotels: "write",
    hotel_assistance: "write",
    wedding_workspace: "read",
    client_finance: "read",
    guests_rsvp: "read",
    menus: "read",
    support: "write",
    live_chat: "write",
  },
  hotels: "demo_hotels",
  finance: "demo_sample",
};

/** §3 line 96. */
const ACTIVE_SUBSCRIPTION: Source = {
  modules: {
    hotel_discovery: "read",
    saved_hotels: "write",
    hotel_assistance: "write",
    support: "write",
  },
  hotels: "all_hotels",
  finance: null,
};

/** §3 line 97: saved hotel names, enquiry status and own invoices stay readable; nothing new. */
const LAPSED_SUBSCRIPTION: Source = {
  modules: {
    saved_hotels: "read",
    hotel_assistance: "read",
    client_finance: "read",
    support: "write",
  },
  hotels: null,
  finance: "own_invoices",
};

/** §3 line 98 and line 109: the agreement's own hotels only, never hotel search. */
const AGREEMENT: Source = {
  modules: {
    hotel_discovery: "read",
    saved_hotels: "read",
    hotel_assistance: "write",
    client_finance: "read",
    support: "write",
  },
  hotels: "agreement_hotels",
  finance: "agreement_invoices",
};

/**
 * §3 line 99, whatever the subscription. Client finance waits for AMPM's answer (Q4), so the
 * project rows open none; full hotel search comes only from an active subscription.
 */
const ACTIVE_PROJECT: Source = {
  modules: {
    hotel_discovery: "read",
    saved_hotels: "write",
    hotel_assistance: "write",
    wedding_workspace: "write",
    guests_rsvp: "read",
    menus: "write",
    support: "write",
    live_chat: "write",
  },
  hotels: "project_hotels",
  finance: null,
};

/**
 * §3 lines 100 and 101, on hold or closed within the window: everything read-only except support,
 * and no live chat. The closed row limits support to the support type, which the request service
 * enforces; its "Read-only" finance cell follows the active row, which grants none until Q4.
 */
const PAUSED_PROJECT: Source = {
  modules: {
    hotel_discovery: "read",
    saved_hotels: "read",
    hotel_assistance: "read",
    wedding_workspace: "read",
    guests_rsvp: "read",
    menus: "read",
    support: "write",
  },
  hotels: "project_hotels",
  finance: null,
};

const LAPSED = new Set<ClientAccountState["subscription"]>(["expired", "cancelled", "suspended"]);

function subscriptionSource(state: ClientAccountState): Source[] {
  if (state.subscription === "active") return [ACTIVE_SUBSCRIPTION];
  return LAPSED.has(state.subscription) ? [LAPSED_SUBSCRIPTION] : [];
}

function projectSource(state: ClientAccountState): Source[] {
  if (state.project === "active") return [ACTIVE_PROJECT];
  // §3 line 102: after the window the membership is removed; documents are asked for outside.
  return state.project === "on_hold" || state.project === "closed_in_window"
    ? [PAUSED_PROJECT]
    : [];
}

/**
 * Step 3 of the pipeline (architecture §6): the modules a client principal may reach, from
 * subscription, agreements and memberships combined (permission-matrix §3). A module is writable
 * when any source opens it for writing. Computed per request and cached by the API for at most
 * five minutes.
 *
 * @example
 * const { modules, readOnlyModules } = resolveClientEntitlements(state);
 * const canAct = modules.includes("menus") && !readOnlyModules.includes("menus");
 */
export function resolveClientEntitlements(state: ClientAccountState): Entitlements {
  if (state.suspended) {
    return {
      modules: [],
      readOnlyModules: [],
      hotelReach: [],
      financeReach: [],
      signInRefused: true,
    };
  }
  const sources = state.isDemo
    ? [DEMO]
    : [
        ...subscriptionSource(state),
        ...(state.hotelAssistanceAgreement ? [AGREEMENT] : []),
        ...projectSource(state),
      ];
  const access = (module: EntitlementModule): Access | undefined => {
    const levels = sources.map((source) => source.modules[module]);
    return levels.includes("write") ? "write" : levels.includes("read") ? "read" : undefined;
  };
  const modules = entitlementModule.options.filter((module) => access(module) !== undefined);
  return {
    modules,
    readOnlyModules: modules.filter((module) => access(module) === "read"),
    hotelReach: HOTEL_ORDER.filter((reach) => sources.some((source) => source.hotels === reach)),
    financeReach: FINANCE_ORDER.filter((reach) => sources.some((s) => s.finance === reach)),
    signInRefused: false,
  };
}
