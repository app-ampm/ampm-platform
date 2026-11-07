import type { BillingType, EntitlementModule, MeResponse } from "@ampm/core";

/** The first word of the principal's name for the "Hello, Ananya" eyebrow; null when the name is blank. */
export function firstName(name: string): string | null {
  const [first] = name.trim().split(/\s+/);
  return first ? first : null;
}

/** The screen's greeting eyebrow, or nothing when the principal has no usable name. */
export function greeting(name: string): string | undefined {
  const first = firstName(name);
  return first ? `Hello, ${first}` : undefined;
}

/**
 * Whether hotel discovery is active: the subscription reaches every hotel (permission-matrix §3).
 * A demo, project or agreement principal reaches a scoped set only and still sees the activation page.
 */
export function isDiscoveryActive(me: MeResponse): boolean {
  return me.entitlements.hotelReach.includes("all_hotels");
}

/** Whether the principal may open a scoped hotel set without the full subscription. */
export function canBrowseHotels(me: MeResponse): boolean {
  return me.entitlements.modules.includes("hotel_discovery");
}

/** Whether the principal may track hotel-consultancy requests (Flow-2). */
export function hasHotelAssistance(me: MeResponse): boolean {
  return me.entitlements.modules.includes("hotel_assistance");
}

const MODULE_LABEL: Record<EntitlementModule, string> = {
  hotel_discovery: "Hotel discovery",
  saved_hotels: "Saved hotels",
  hotel_assistance: "Hotel assistance",
  wedding_workspace: "Wedding workspace",
  client_finance: "Budget and invoices",
  guests_rsvp: "Guests and RSVP",
  menus: "Menus",
  support: "Support",
  live_chat: "Live chat",
};

/** What a plan module is called on the plan card's "included" list. */
export function moduleLabel(module: EntitlementModule): string {
  return MODULE_LABEL[module];
}

const BILLING_LABEL: Record<BillingType, string> = {
  one_time: "One-time",
  recurring: "Recurring",
};

/** The plan's billing as its chip reads it ("One-time"). */
export function billingLabel(billing: BillingType): string {
  return BILLING_LABEL[billing];
}

/** A plan's term as the card states it ("30 days from payment"). */
export function termLabel(days: number): string {
  return days === 1 ? "1 day from payment" : `${days} days from payment`;
}

/**
 * Where a plan's purchase stands on this screen: not started, started and waiting for its payment, or
 * paid and activating (from the payment's first tap until `/me` brings the new entitlements).
 */
export type PaymentPhase = "idle" | "pending" | "activating";

export function paymentPhase(pendingId: string | null, activating: boolean): PaymentPhase {
  if (pendingId === null) return "idle";
  return activating ? "activating" : "pending";
}
