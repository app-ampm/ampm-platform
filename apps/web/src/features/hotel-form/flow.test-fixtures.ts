import type { HotelFormCodeIssued, HotelFormOpenAnswer } from "@ampm/core";

import { EMPTY_DETAILS } from "./details.form";
import { INITIAL_FLOW, flowReducer, type FlowEvent, type FlowState } from "./flow";

/* The identity step's flow as its tests drive it: synthetic links, codes and people. Tests only. */

export const SECRET = `hfl_${"x".repeat(43)}`;
export const SESSION = `hfs_${"y".repeat(43)}`;
export const NOW = Date.parse("2026-11-25T10:00:00.000Z");
export const READY: HotelFormOpenAnswer = {
  state: "ready",
  expiresAt: "2026-12-25T10:00:00.000Z",
  helpContact: "Call AMPM on +91 22 0000 0000",
};
export const ISSUED: HotelFormCodeIssued = {
  challengeId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
  maskedMobile: "+91 ••••• •1234",
  expiresAt: "2026-11-25T10:05:00.000Z",
  resendAfter: "2026-11-25T10:00:30.000Z",
  delivery: "screen",
  code: "482917",
};
export const CLAIM = { ...EMPTY_DETAILS, fullName: "Asha Rao", mobile: "70000 01234" };
export const PERSON = "0192f3a0-7d3e-7b1a-9c2f-0000000000a5";
export const OTHER_PERSON = "0192f3a0-7d3e-7b1a-9c2f-0000000000b7";

/** The flow after these events, from the start. */
export function after(...events: readonly FlowEvent[]): FlowState {
  return events.reduce(flowReducer, INITIAL_FLOW);
}

/** The link opened to `answer`, with a session kept from before a reload when given. */
export const opened = (answer = READY, session: string | null = null): FlowEvent => ({
  type: "opened",
  secret: SECRET,
  answer,
  session,
});

/** The events that lead to HF-03, the code asked for with the claim. */
export const atCode = [
  opened(),
  { type: "start" },
  { type: "claim_changed", claim: CLAIM },
  { type: "code_issued", issued: ISSUED, now: NOW },
] as const satisfies readonly FlowEvent[];
