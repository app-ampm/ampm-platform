import { HOTEL_FORM_ERRORS, type HotelFormSessionRefusal } from "@ampm/core";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  formCalls,
  freshIp,
  freshMobile,
  setPolicy,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
} from "./hotel-form-suite.js";
import { requestCalls } from "./hotel-info-requests-suite.js";

/*
 * Hotel form sessions end to end (D-189 §5): GET and PATCH me inside a session, the write window, and
 * HotelFormSessionGuard's re-checks on every call against the test database: sign-out, a reissued link, a
 * removed person, a revoked request, 2 hours idle and 12 in all, a person's fourth session ending the
 * oldest, last_seen at most once a minute, and 404 while the mode is off. Each refusal is a 401 whose
 * reason the page reads.
 */
describe("The hotel form's sessions (e2e, D-189 §5)", () => {
  let suite: FormSuite;
  const calls = formCalls(() => suite);
  const HOUR = 60 * 60 * 1000;

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-sessions-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  /** A 401 and the reason its details carry. */
  const expectRefused = (response: Response, reason: HotelFormSessionRefusal) => {
    expect(response.status).toBe(401);
    expect(response.body.error.details).toEqual([{ path: "reason", message: reason }]);
  };

  it("answers me, and changes your own name as an audited event", async () => {
    const link = await testLink(suite);
    const { sessionToken, challengeId } = await signIn(suite, link.secret, freshMobile());
    const me = await calls.me(sessionToken).expect(200);
    const { id: personId } = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id },
      select: { id: true },
    });
    expect(me.body.data).toEqual({
      personId,
      person: { fullName: "E2E Synthetic Person", designation: "General Manager" },
      request: {
        displayLabel: null,
        staffNote: null,
        status: "open",
        expiresAt: expect.any(String),
      },
    });
    const changed = await calls.patchMe(sessionToken, { fullName: "Renamed Person" }).expect(200);
    expect(changed.body.data.person.fullName).toBe("Renamed Person");
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id },
    });
    expect(person.fullName).toBe("Renamed Person");
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: person.id, action: "update" },
    });
    expect(audit).toMatchObject({
      actorType: "guest_token",
      actorRef: `hir:${link.id}/person:${person.id}`,
    });
    expect(audit.afterJson).toEqual({
      id: person.id,
      requestId: link.id,
      changedFields: ["fullName"],
    });
    const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
      where: { requestId: link.id, eventType: "person_updated" },
    });
    expect(event).toMatchObject({ actorKind: "hotel_person", actorPersonId: person.id });
    expect(event.detail).toEqual({ fields: ["fullName"] });
    expect(challengeId).toBeTruthy();
  });

  it("holds each session to 10 changes a minute, refusing more with Retry-After", async () => {
    const link = await testLink(suite);
    const mobile = freshMobile();
    const { sessionToken } = await signIn(suite, link.secret, mobile);
    for (let change = 0; change < 10; change += 1) {
      await calls.patchMe(sessionToken, { fullName: `Name ${change}` }).expect(200);
    }
    const over = await calls.patchMe(sessionToken, { fullName: "Name 10" }).expect(429);
    expect(over.body.error.message).toBe(HOTEL_FORM_ERRORS.writeLimit);
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
    const other = await signIn(suite, link.secret, mobile);
    await calls.patchMe(other.sessionToken, { fullName: "Name 11" }).expect(200);
  });

  it("refuses a bad token as no_session, and a mobile in PATCH me", async () => {
    expectRefused(await calls.me(`hfs_${"z".repeat(43)}`), "no_session");
    expectRefused(await calls.me("hfl_not-a-session"), "no_session");
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await calls.patchMe(sessionToken, { mobile: "+917000009999" }).expect(400);
  });

  it("ends a session at sign-out", async () => {
    const link = await testLink(suite);
    const { sessionToken, challengeId } = await signIn(suite, link.secret, freshMobile());
    expect((await calls.signOut(sessionToken).expect(200)).body.data).toEqual({ ok: true });
    expectRefused(await calls.me(sessionToken), "session_ended");
    const row = await suite.prisma.hotelInfoRequestChallenge.findUniqueOrThrow({
      where: { id: challengeId },
    });
    expect(row.sessionEndedAt).not.toBeNull();
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: challengeId, entityType: "hotel_form_session" },
    });
    expect(audit.actorType).toBe("guest_token");
  });

  it("ends every session of a link AMPM reissued", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await requestCalls(() => suite)
      .reissue("sa", link.id)
      .expect(200);
    expectRefused(await calls.me(sessionToken), "link_changed");
  });

  it("ends the sessions of a person AMPM removed, and of a revoked request", async () => {
    const link = await testLink(suite);
    const mobile = freshMobile();
    const { sessionToken } = await signIn(suite, link.secret, mobile);
    await suite.prisma.hotelInfoRequestPerson.updateMany({
      where: { requestId: link.id, phone: mobile },
      data: { removedAt: new Date() },
    });
    expectRefused(await calls.me(sessionToken), "person_removed");
    const other = await testLink(suite);
    const second = await signIn(suite, other.secret, freshMobile());
    await requestCalls(() => suite)
      .revoke("sa", other.id, { reason: "E2E synthetic revoke" })
      .expect(200);
    expectRefused(await calls.me(second.sessionToken), "not_active");
  });

  it("expires a session after 2 hours idle, and 12 hours after it started", async () => {
    const link = await testLink(suite);
    const idle = await signIn(suite, link.secret, freshMobile());
    await suite.prisma.hotelInfoRequestChallenge.update({
      where: { id: idle.challengeId },
      data: { sessionLastSeenAt: new Date(Date.now() - 2 * HOUR - 1000) },
    });
    expectRefused(await calls.me(idle.sessionToken), "session_expired");
    const long = await signIn(suite, link.secret, freshMobile());
    await suite.prisma.hotelInfoRequestChallenge.update({
      where: { id: long.challengeId },
      data: { sessionStartedAt: new Date(Date.now() - 12 * HOUR), sessionLastSeenAt: new Date() },
    });
    expectRefused(await calls.me(long.sessionToken), "session_expired");
  });

  it("ends a person's oldest session when they open a fourth", async () => {
    const link = await testLink(suite);
    const mobile = freshMobile();
    const sessions = [];
    for (let count = 0; count < 4; count += 1)
      sessions.push(await signIn(suite, link.secret, mobile));
    expectRefused(await calls.me(sessions[0]?.sessionToken ?? ""), "session_ended");
    for (const session of sessions.slice(1)) await calls.me(session.sessionToken).expect(200);
  });

  it("writes last_seen at most once a minute", async () => {
    const link = await testLink(suite);
    const { sessionToken, challengeId } = await signIn(suite, link.secret, freshMobile());
    const seen = async () =>
      (
        await suite.prisma.hotelInfoRequestChallenge.findUniqueOrThrow({
          where: { id: challengeId },
        })
      ).sessionLastSeenAt;
    const first = await seen();
    await calls.me(sessionToken, freshIp()).expect(200);
    expect(await seen()).toEqual(first);
    const earlier = new Date(Date.now() - 2 * 60_000);
    await suite.prisma.hotelInfoRequestChallenge.update({
      where: { id: challengeId },
      data: { sessionLastSeenAt: earlier },
    });
    await calls.me(sessionToken).expect(200);
    expect((await seen())?.getTime()).toBeGreaterThan(earlier.getTime());
  });

  it("answers 404 on a session route while the mode is off, then lets the session back", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await setPolicy(suite, { mode: "off" });
    await calls.me(sessionToken).expect(404);
    await setPolicy(suite, {});
    await calls.me(sessionToken).expect(200);
  });
});
