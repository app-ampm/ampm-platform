import {
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SESSION_REFUSAL_MESSAGES,
  type HotelFormCodeIssued,
  type HotelFormOpenAnswer,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { EMPTY_DETAILS } from "./details.form";
import { INITIAL_FLOW, flowReducer, type FlowEvent, type FlowState } from "./flow";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";

/* The identity step's flow (D-189 §8): HF-01 → HF-02 → HF-03 → signed in, HF-08, and the refusals. */

const SECRET = `hfl_${"x".repeat(43)}`;
const SESSION = `hfs_${"y".repeat(43)}`;
const NOW = Date.parse("2026-11-25T10:00:00.000Z");
const READY: HotelFormOpenAnswer = {
  state: "ready",
  expiresAt: "2026-12-25T10:00:00.000Z",
  helpContact: "Call AMPM on +91 22 0000 0000",
};
const ISSUED: HotelFormCodeIssued = {
  challengeId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
  maskedMobile: "+91 ••••• •1234",
  expiresAt: "2026-11-25T10:05:00.000Z",
  resendAfter: "2026-11-25T10:00:30.000Z",
  delivery: "screen",
  code: "482917",
};
const CLAIM = { ...EMPTY_DETAILS, fullName: "Asha Rao", mobile: "70000 01234" };

/** The flow after these events, from the start. */
function after(...events: readonly FlowEvent[]): FlowState {
  return events.reduce(flowReducer, INITIAL_FLOW);
}

const opened = (answer = READY, session: string | null = null): FlowEvent => ({
  type: "opened",
  secret: SECRET,
  answer,
  session,
});
const atCode = [
  opened(),
  { type: "start" },
  { type: "claim_changed", claim: CLAIM },
  { type: "code_issued", issued: ISSUED, now: NOW },
] as const satisfies readonly FlowEvent[];

describe("opening the link", () => {
  it("starts by opening it", () => {
    expect(INITIAL_FLOW.phase).toEqual({ kind: "opening" });
  });

  it("welcomes the person to a link that is ready (HF-01)", () => {
    const state = after(opened());
    expect(state.phase).toEqual({ kind: "welcome" });
    expect(state.link).toEqual({ secret: SECRET, state: "ready", expiresAt: READY.expiresAt });
    expect(state.helpContact).toBe(READY.helpContact);
  });

  it("goes straight to the signed-in page with a session kept from before a reload", () => {
    expect(after(opened(READY, SESSION))).toMatchObject({
      phase: { kind: "signed_in", reverify: null },
      session: SESSION,
    });
  });

  it("shows HF-08, with AMPM's help contact, for a link that is not active", () => {
    const state = after(
      opened({ state: "not_active", expiresAt: null, helpContact: "Email AMPM" }),
    );
    expect(state.phase).toEqual({ kind: "gone", message: null });
    expect(state.helpContact).toBe("Email AMPM");
  });

  it("shows HF-08 when the form is switched off (every route answers 404)", () => {
    const state = after({
      type: "open_failed",
      refusal: { kind: "gone", message: null },
      now: NOW,
    });
    expect(state.phase).toEqual({ kind: "gone", message: null });
  });

  it("says when the page has no link at all", () => {
    expect(after({ type: "no_link" }).phase).toEqual({ kind: "no_link" });
  });

  it("offers to try again when the API cannot be reached, after any wait it asked for", () => {
    const unreachable = after({
      type: "open_failed",
      refusal: { kind: "wait", message: "Too many tries", seconds: 20 },
      now: NOW,
    });
    expect(unreachable.phase).toEqual({
      kind: "unreachable",
      message: "Too many tries",
      retryAt: NOW + 20_000,
    });
    expect(flowReducer(unreachable, { type: "reopen" }).phase).toEqual({ kind: "opening" });
  });
});

describe("your details and the code (HF-02, HF-03)", () => {
  it("asks for the details once the person starts, keeping what they type", () => {
    const state = after(opened(), { type: "start" }, { type: "claim_changed", claim: CLAIM });
    expect(state.phase).toEqual({ kind: "identity", identity: { step: "details" } });
    expect(state.claim).toEqual(CLAIM);
  });

  it("shows the details' errors until the next try", () => {
    const state = after(
      opened(),
      { type: "start" },
      { type: "details_invalid", errors: { mobile: "Bad" } },
    );
    expect(state.errors).toEqual({ mobile: "Bad" });
  });

  it("moves to the code with the resend countdown once a code is issued", () => {
    const state = after(...atCode);
    expect(state.phase).toEqual({
      kind: "identity",
      identity: { step: "code", issued: ISSUED, resendAt: NOW + 30_000 },
    });
    expect(state.code).toBe("");
  });

  it("goes back to the details with Change, keeping them", () => {
    const state = after(...atCode, { type: "change_details" });
    expect(state.phase).toEqual({ kind: "identity", identity: { step: "details" } });
    expect(state.claim).toEqual(CLAIM);
  });

  it("keeps a refused code's digits and puts the refusal on the code field", () => {
    const state = after(
      ...atCode,
      { type: "code_changed", code: "111111" },
      {
        type: "refused",
        refusal: { kind: "field", field: "oneTimeCode", message: HOTEL_FORM_ERRORS.invalidCode },
        now: NOW,
      },
    );
    expect(state.code).toBe("111111");
    expect(state.codeError).toBe(HOTEL_FORM_ERRORS.invalidCode);
  });

  it("counts down a refusal that says how long to wait", () => {
    const state = after(...atCode, {
      type: "refused",
      refusal: { kind: "wait", message: HOTEL_FORM_ERRORS.tooSoon, seconds: 25 },
      now: NOW,
    });
    expect(state.notice).toEqual({
      message: HOTEL_FORM_ERRORS.tooSoon,
      retryAt: NOW + 25_000,
      isReload: false,
    });
  });

  it("asks for a reload when the notice changed", () => {
    const state = after(
      opened(),
      { type: "start" },
      {
        type: "refused",
        refusal: { kind: "reload", message: HOTEL_FORM_ERRORS.noticeStale },
        now: NOW,
      },
    );
    expect(state.notice).toEqual({
      message: HOTEL_FORM_ERRORS.noticeStale,
      retryAt: null,
      isReload: true,
    });
  });

  it("puts a refused answer back on its field", () => {
    const state = after(
      opened(),
      { type: "start" },
      {
        type: "refused",
        refusal: {
          kind: "field",
          field: "mobile",
          message: "Enter a 10-digit Indian mobile number",
        },
        now: NOW,
      },
    );
    expect(state.errors).toEqual({ mobile: "Enter a 10-digit Indian mobile number" });
  });

  it("signs the person in once the code is right, keeping the session", () => {
    const state = after(...atCode, { type: "verified", sessionToken: SESSION });
    expect(state.phase).toEqual({ kind: "signed_in", reverify: null });
    expect(state.session).toBe(SESSION);
    expect(state.notice).toBeNull();
  });

  it("ends at HF-08 when the link stops working on the way", () => {
    const state = after(...atCode, {
      type: "refused",
      refusal: { kind: "gone", message: HOTEL_FORM_ERRORS.notActive },
      now: NOW,
    });
    expect(state.phase).toEqual({ kind: "gone", message: HOTEL_FORM_ERRORS.notActive });
  });
});

describe("a refused session", () => {
  const signedIn = [...atCode, { type: "verified", sessionToken: SESSION }] as const;

  it("asks for a new code in place, over the signed-in page, keeping the details typed", () => {
    const message = HOTEL_FORM_SESSION_REFUSAL_MESSAGES.session_expired;
    const state = after(...signedIn, {
      type: "session_refused",
      refusal: { kind: "new_code", message },
    });
    expect(state.phase).toEqual({ kind: "signed_in", reverify: { step: "details" } });
    expect(state.session).toBeNull();
    expect(state.claim).toEqual(CLAIM);
    expect(state.notice).toEqual({ message, retryAt: null, isReload: false });
  });

  it("takes the new code in place and closes the request for it", () => {
    const state = after(
      ...signedIn,
      { type: "session_refused", refusal: { kind: "new_code", message: "Enter a new code." } },
      { type: "code_issued", issued: ISSUED, now: NOW },
    );
    expect(state.phase).toEqual({
      kind: "signed_in",
      reverify: { step: "code", issued: ISSUED, resendAt: NOW + 30_000 },
    });
    const back = flowReducer(state, { type: "verified", sessionToken: SESSION });
    expect(back.phase).toEqual({ kind: "signed_in", reverify: null });
    expect(back.session).toBe(SESSION);
  });

  it("asks for a new code in place when a session kept from before a reload has ended", () => {
    const state = after(opened(READY, SESSION), {
      type: "session_refused",
      refusal: { kind: "new_code", message: "Enter a new code to continue." },
    });
    expect(state.phase).toEqual({ kind: "signed_in", reverify: { step: "details" } });
  });

  it("fills the details in from the person's own when nothing typed is left (after a reload)", () => {
    const person = { fullName: "Asha Rao", designation: "Chief Engineer" };
    const state = after(opened(READY, SESSION), {
      type: "session_refused",
      refusal: { kind: "new_code", message: "Enter a new code to continue." },
      person,
    });
    expect(state.claim).toMatchObject({
      fullName: "Asha Rao",
      designationChoice: "Other",
      designationOther: "Chief Engineer",
      mobile: "",
    });
  });

  it("ends at HF-08, in the API's words, when AMPM replaced the link or removed the person", () => {
    const message = HOTEL_FORM_SESSION_REFUSAL_MESSAGES.person_removed;
    const state = after(...signedIn, {
      type: "session_refused",
      refusal: { kind: "gone", message },
    });
    expect(state.phase).toEqual({ kind: "gone", message });
    expect(state.session).toBeNull();
  });

  it("returns to the welcome after signing out, forgetting the details typed", () => {
    const state = after(...signedIn, { type: "signed_out" });
    expect(state.phase).toEqual({ kind: "welcome" });
    expect(state.session).toBeNull();
    expect(state.claim).toEqual(EMPTY_DETAILS);
    expect(state.notice?.message).toBe(HOTEL_FORM_COPY.welcome.signedOut);
  });
});
