import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTACT, draftCalls, firstSave, PROPERTY } from "./hotel-form-draft-suite.js";
import {
  claimFor,
  formCalls,
  freshMobile,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
  type IssuedLink,
} from "./hotel-form-suite.js";

/*
 * The person's own answer to 7.5 on `me` and the verify answer, end to end (D-190 §3): what HF-07 reads to
 * offer withdrawing the permission to show photos only to someone who gave it. A No answers no; a colleague
 * who never submitted answers none; a Yes withdrawn answers none. Synthetic data only.
 */
describe("The person's own answer to 7.5 on me (e2e, D-190 §3)", () => {
  let suite: FormSuite;
  const calls = draftCalls(() => suite);
  const form = formCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-photo-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  /** A request submitted with `display` as the answer to 7.5, and its submitter's session and mobile. */
  async function submittedWith(display: "yes" | "no"): Promise<{
    link: IssuedLink;
    sessionToken: string;
    mobile: string;
  }> {
    const link = await testLink(suite);
    const mobile = freshMobile();
    const { sessionToken } = await signIn(suite, link.secret, mobile);
    await calls.save(sessionToken, "property", firstSave(PROPERTY)).expect(200);
    await calls.save(sessionToken, "contact", firstSave(CONTACT)).expect(200);
    await calls.submit(sessionToken, await calls.reviewedBody(sessionToken, display)).expect(200);
    return { link, sessionToken, mobile };
  }

  const photoPermissionOf = async (sessionToken: string): Promise<unknown> =>
    (await form.me(sessionToken).expect(200)).body.data.photoPermission;

  it("answers none before any submit", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    expect(await photoPermissionOf(sessionToken)).toBe("none");
  });

  it("answers no after a submit with No, on me, on PATCH me and on a new code", async () => {
    const { link, sessionToken, mobile } = await submittedWith("no");
    expect(await photoPermissionOf(sessionToken)).toBe("no");
    const patched = await form.patchMe(sessionToken, { designation: "Sales Manager" }).expect(200);
    expect(patched.body.data.photoPermission).toBe("no");
    suite.store.clear();
    const issued = await form.codes(claimFor(link.secret, mobile)).expect(200);
    const { challengeId, code } = issued.body.data;
    const verified = await form
      .verify({ token: link.secret, challengeId, oneTimeCode: code })
      .expect(200);
    expect(verified.body.data.photoPermission).toBe("no");
  });

  it("answers none to a colleague who did not submit, whatever the submitter answered", async () => {
    const { link, sessionToken } = await submittedWith("yes");
    const colleague = await signIn(suite, link.secret, freshMobile(), {
      fullName: "E2E Synthetic Colleague",
    });
    expect(await photoPermissionOf(colleague.sessionToken)).toBe("none");
    expect(await photoPermissionOf(sessionToken)).toBe("yes");
  });

  it("answers yes after a submit with Yes, and none once the person withdrew it", async () => {
    const { sessionToken } = await submittedWith("yes");
    expect(await photoPermissionOf(sessionToken)).toBe("yes");
    await calls
      .withdraw(sessionToken, { kind: "display_authorisation", requestRemoval: false })
      .expect(200);
    expect(await photoPermissionOf(sessionToken)).toBe("none");
  });
});
