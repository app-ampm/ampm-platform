import { renderToStaticMarkup } from "react-dom/server";

import type { HotelFormCodeIssued, HotelFormMe } from "@ampm/core";

import { INITIAL_FLOW, type FlowState } from "./flow";
import { HotelFormScreen } from "./hotel-form-screen";
import type { HotelFormFlow } from "./use-hotel-form-flow";

/*
 * The hotel form's screens rendered from a flow's state alone, as the server would send them: no API, no
 * browser. Imported by tests only.
 */

export const SECRET = `hfl_${"x".repeat(43)}`;
export const SESSION = `hfs_${"y".repeat(43)}`;
export const HELP = "Call AMPM on +91 22 0000 0000";
export const LINK = {
  secret: SECRET,
  state: "ready",
  expiresAt: "2026-12-25T10:00:00.000Z",
} as const;

export const ON_SCREEN: HotelFormCodeIssued = {
  challengeId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
  maskedMobile: "+91 ••••• •1234",
  expiresAt: "2026-11-25T10:05:00.000Z",
  resendAfter: "2026-11-25T10:00:30.000Z",
  delivery: "screen",
  code: "482917",
};

export const BY_SMS: HotelFormCodeIssued = {
  challengeId: ON_SCREEN.challengeId,
  maskedMobile: ON_SCREEN.maskedMobile,
  expiresAt: ON_SCREEN.expiresAt,
  resendAfter: ON_SCREEN.resendAfter,
  delivery: "sms",
};

export const ME: HotelFormMe = {
  person: { fullName: "Asha Rao", designation: "General Manager" },
  request: {
    displayLabel: "Seasonal refresh 2027",
    staffNote: "Please add the new banquet hall.",
    status: "open",
    expiresAt: "2026-12-25T10:00:00.000Z",
  },
};

const noop = (): undefined => undefined;

/** A flow at a state, doing nothing when asked. */
export function flowAt(
  state: Partial<FlowState>,
  overrides: Partial<HotelFormFlow> = {},
): HotelFormFlow {
  return {
    state: { ...INITIAL_FLOW, link: LINK, helpContact: HELP, ...state },
    me: { data: undefined, isLoading: false, error: null, retry: noop },
    isSendingCode: false,
    isVerifying: false,
    isSigningOut: false,
    reopen: noop,
    start: noop,
    changeClaim: noop,
    sendCode: noop,
    changeCode: noop,
    verifyCode: noop,
    changeDetails: noop,
    saveDetails: () => Promise.resolve({ kind: "saved" }),
    signOut: noop,
    ...overrides,
  };
}

/** The screen for a flow, as markup. */
export function screenOf(flow: HotelFormFlow): string {
  return renderToStaticMarkup(<HotelFormScreen flow={flow} siteKey="test-site-key" />);
}

/** The opening tags of `element` carrying `attribute`, whatever order React writes them in. */
export function tagsWith(html: string, element: string, attribute: string): string[] {
  return [...html.matchAll(new RegExp(`<${element}[^>]*>`, "g"))]
    .map((match) => match[0])
    .filter((tag) => tag.includes(attribute));
}

/** Markup with React's entity escapes read back, so copy with apostrophes can be found as written. */
export function decoded(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The words of every button, in order. */
export function buttonsIn(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    (match[1] ?? "").replace(/<[^>]+>/g, ""),
  );
}
