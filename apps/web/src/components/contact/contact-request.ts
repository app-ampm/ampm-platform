import type { LeadEnquiryRequest } from "@ampm/core";

/*
 * The contact page's request in plain terms: which form a link opens, and how AMPM will reach the
 * visitor once the request is in (PUB-06, PUB-09). Pure, so the page and its tests share it.
 */

/** `/contact?type=demo` (every "Request a demo" on the site) opens the form on the demo request. */
export function isDemoRequest(type: string | string[] | undefined): boolean {
  return Array.isArray(type) ? type.includes("demo") : type === "demo";
}

/** What the confirmation needs from the request the form sent: never more than the visitor typed. */
export type ReceivedRequest = Pick<
  LeadEnquiryRequest,
  "email" | "phone" | "contactPreference" | "requestedDemo"
>;

export type ReachChannel = "call" | "whatsapp" | "email";

/** The channel AMPM will use and the address on it, as the confirmation prints it. */
export interface Reach {
  readonly channel: ReachChannel;
  readonly address: string;
}

/**
 * "+919876543210" (the schema's form of a 10-digit Indian mobile) as W7 prints it, "+91 98765 43210";
 * any other number as it was sent.
 */
export function displayPhone(phone: string): string {
  const indian = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return indian ? `+91 ${indian[1]} ${indian[2]}` : phone;
}

/**
 * How AMPM will reach the visitor (W7): the way they chose when they gave its address, otherwise a
 * call on their mobile, otherwise their email. Null only for a request with neither, which the
 * schema refuses.
 *
 *   reachOf({ phone: "+919876543210", contactPreference: "whatsapp" })
 *   // { channel: "whatsapp", address: "+91 98765 43210" }
 */
export function reachOf({ email, phone, contactPreference }: ReceivedRequest): Reach | null {
  if (contactPreference === "email" && email) return { channel: "email", address: email };
  if (phone) {
    const channel = contactPreference === "whatsapp" ? "whatsapp" : "call";
    return { channel, address: displayPhone(phone) };
  }
  return email ? { channel: "email", address: email } : null;
}
