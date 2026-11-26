import { HOTEL_FORM_SESSION_REFUSAL_MESSAGES } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { EMPTY_DETAILS } from "./details.form";
import { flowReducer } from "./flow";
import {
  CLAIM,
  ISSUED,
  NOW,
  OTHER_PERSON,
  PERSON,
  READY,
  SESSION,
  after,
  atCode,
  opened,
} from "./flow.test-fixtures";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";

/*
 * The flow once signed in (D-189 §8, D-190 §5): a session refused asks for a new code in place, ends at
 * HF-08 or signs out, and the flow knows whose session it holds (review fix E1).
 */

describe("a refused session", () => {
  const signedIn = [
    ...atCode,
    { type: "verified", sessionToken: SESSION, personId: PERSON },
  ] as const;

  it("forgets whose session it was with the session, and learns it again from the new code", () => {
    const refused = after(...signedIn, {
      type: "session_refused",
      refusal: { kind: "new_code", message: "Enter a new code." },
    });
    expect(refused.personId).toBeNull();
    const back = flowReducer(refused, {
      type: "verified",
      sessionToken: `hfs_${"z".repeat(43)}`,
      personId: OTHER_PERSON,
    });
    expect(back.personId).toBe(OTHER_PERSON);
  });

  it("keeps whose session it is when the same link opens again on it, and not for another", () => {
    const again = after(...signedIn, { type: "reopen" }, opened(READY, SESSION));
    expect(again.personId).toBe(PERSON);
    const restored = after(...signedIn, { type: "reopen" }, opened(READY, `hfs_${"z".repeat(43)}`));
    expect(restored.personId).toBeNull();
    expect(after(...signedIn, { type: "signed_out" }).personId).toBeNull();
  });

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
    const back = flowReducer(state, { type: "verified", sessionToken: SESSION, personId: PERSON });
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
