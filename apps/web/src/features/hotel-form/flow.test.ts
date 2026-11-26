import { HOTEL_FORM_ERRORS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { INITIAL_FLOW, flowReducer, openingKeyOf, waitFor } from "./flow";
import {
  CLAIM,
  ISSUED,
  NOW,
  PERSON,
  READY,
  SECRET,
  SESSION,
  after,
  atCode,
  opened,
} from "./flow.test-fixtures";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";

/* The identity step's flow (D-189 §8): HF-01 → HF-02 → HF-03 → signed in, HF-08, and the refusals. */

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

  it("opens afresh for every link that arrives, one arriving while another still opens included", () => {
    const again = after({ type: "reopen" });
    const twice = after({ type: "reopen" }, { type: "reopen" });
    expect(twice.phase).toEqual({ kind: "opening" });
    const keys = [INITIAL_FLOW, again, twice].map(openingKeyOf);
    expect(keys.every((key) => key !== null)).toBe(true);
    expect(new Set(keys).size).toBe(3);
    expect(openingKeyOf(after(opened()))).toBeNull();
  });
});

describe("your details and the code (HF-02, HF-03)", () => {
  it("asks for the details once the person starts, keeping what they type", () => {
    const state = after(opened(), { type: "start" }, { type: "claim_changed", claim: CLAIM });
    expect(state.phase).toEqual({ kind: "identity", identity: { step: "details" } });
    expect(state.claim).toEqual(CLAIM);
  });

  it("clears the details' errors once a try finds the answers complete", () => {
    const state = after(
      opened(),
      { type: "start" },
      { type: "details_checked", errors: { mobile: "Bad" } },
      { type: "details_checked", errors: {} },
    );
    expect(state.errors).toEqual({});
  });

  it("shows the details' errors until the next try", () => {
    const state = after(
      opened(),
      { type: "start" },
      { type: "details_checked", errors: { mobile: "Bad" } },
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
        call: "verify",
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
      call: "send",
    });
    expect(state.notice).toEqual({
      message: HOTEL_FORM_ERRORS.tooSoon,
      retryAt: NOW + 25_000,
      isReload: false,
      heldCall: "send",
    });
  });

  it("holds back only the call a wait refused: entering the code, or asking for one", () => {
    const wait = { kind: "wait", message: HOTEL_FORM_COPY.errors.tooMany, seconds: 42 } as const;
    const verify = after(...atCode, { type: "refused", refusal: wait, now: NOW, call: "verify" });
    expect(waitFor(verify.notice, "verify")).toBe(NOW + 42_000);
    expect(waitFor(verify.notice, "send")).toBeNull();
    const send = after(...atCode, { type: "refused", refusal: wait, now: NOW, call: "send" });
    expect(waitFor(send.notice, "send")).toBe(NOW + 42_000);
    expect(waitFor(send.notice, "verify")).toBeNull();
    expect(waitFor(null, "send")).toBeNull();
  });

  it("asks for a reload when the notice changed", () => {
    const state = after(
      opened(),
      { type: "start" },
      {
        type: "refused",
        refusal: { kind: "reload", message: HOTEL_FORM_ERRORS.noticeStale },
        now: NOW,
        call: "send",
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
        call: "send",
      },
    );
    expect(state.errors).toEqual({ mobile: "Enter a 10-digit Indian mobile number" });
  });

  it("signs the person in once the code is right, keeping the session and whose it is", () => {
    const state = after(...atCode, { type: "verified", sessionToken: SESSION, personId: PERSON });
    expect(state.phase).toEqual({ kind: "signed_in", reverify: null });
    expect(state.session).toBe(SESSION);
    expect(state.personId).toBe(PERSON);
    expect(state.notice).toBeNull();
  });

  it("ends at HF-08 when the link stops working on the way", () => {
    const state = after(...atCode, {
      type: "refused",
      refusal: { kind: "gone", message: HOTEL_FORM_ERRORS.notActive },
      now: NOW,
      call: "verify",
    });
    expect(state.phase).toEqual({ kind: "gone", message: HOTEL_FORM_ERRORS.notActive });
  });
});
