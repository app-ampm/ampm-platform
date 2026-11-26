import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyOf,
  hotelFormSectionConflictOf,
} from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTACT, draftCalls, firstSave, PROPERTY } from "./hotel-form-draft-suite.js";
import {
  freshMobile,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
  type IssuedLink,
} from "./hotel-form-suite.js";

/*
 * What a hotel's people can do once the form is submitted, end to end (D-190 §3 and §4): ask for a
 * correction (never before a first submit; 5 per request a day; also while status-only after the merge),
 * its message kept in its own restricted row and nowhere else; and withdraw 7.5 or every consent, or ask
 * for their details to be removed, each with its event, an allow-listed audit and an in-app notice to the
 * Super Admins only. Synthetic data only.
 */
describe("Corrections and withdrawal (e2e, D-190 §3)", () => {
  let suite: FormSuite;
  const calls = draftCalls(() => suite);
  const MESSAGE = "E2E: the lawn seats 900 guests, not 600.";

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-after-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  /** A submitted request and its submitter's session and person. */
  async function submitted(): Promise<{
    link: IssuedLink;
    sessionToken: string;
    personId: string;
  }> {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await calls.save(sessionToken, "property", firstSave(PROPERTY)).expect(200);
    await calls.save(sessionToken, "contact", firstSave(CONTACT)).expect(200);
    await calls.submit(sessionToken, await calls.reviewedBody(sessionToken)).expect(200);
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id },
    });
    return { link, sessionToken, personId: person.id };
  }

  /** The person's mobile, as the identity step stored it (E.164), to sign them in again. */
  function mobileOf(personId: string, link: IssuedLink): Promise<string> {
    return suite.prisma.hotelInfoRequestPerson
      .findFirstOrThrow({ where: { id: personId, requestId: link.id }, select: { phone: true } })
      .then((person) => person.phone);
  }

  /** A refusal's envelope as the AppError the api-client would raise, for core's readers. */
  function appErrorOf(body: {
    error: { code: AppError["code"]; message: string; details?: AppError["details"] };
  }): AppError {
    return new AppError(body.error.code, body.error.message, body.error.details);
  }

  /** The users a request's staff notices of `templateKey` went to, by role. */
  async function recipientRolesOf(requestId: string, templateKey: string): Promise<string[]> {
    const rows = await suite.prisma.notification.findMany({
      where: { entityId: requestId, templateKey },
      select: { recipientId: true, channel: true },
    });
    const users = await suite.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.recipientId) } },
      select: { roles: { select: { role: { select: { roleKey: true } } } } },
    });
    const roles = users.flatMap((user) => user.roles.map((entry) => entry.role.roleKey));
    return [...new Set(roles)].sort();
  }

  it("refuses a correction before the form was ever submitted with 409 notSubmitted", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const refused = await calls
      .correct(sessionToken, { message: MESSAGE, botToken: "dev-bot-check" })
      .expect(409);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.notSubmitted);
  });

  it("stores a correction in its own row, names it by id only, and tells staff without it", async () => {
    const { link, sessionToken, personId } = await submitted();
    const sent = await calls.correct(sessionToken, { message: MESSAGE, botToken: "dev-bot-check" });
    expect(sent.status).toBe(200);
    expect(sent.body.data).toEqual({ ok: true });
    const correction = await suite.prisma.hotelInfoRequestCorrection.findFirstOrThrow({
      where: { requestId: link.id },
    });
    expect(correction).toMatchObject({ personId, message: MESSAGE, handledAt: null });
    const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
      where: { requestId: link.id, eventType: "correction_requested" },
    });
    expect(event.detail).toEqual({ correctionId: correction.id });
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: correction.id },
    });
    expect(audit).toMatchObject({ action: "create", actorType: "guest_token" });
    expect(await recipientRolesOf(link.id, "system.hotel_form_correction")).toEqual([
      "hotel_team",
      "super_admin",
    ]);
    const [counts] = await suite.prisma.$queryRaw<
      { events: bigint; audits: bigint; notices: bigint }[]
    >`
      SELECT
        (SELECT count(*) FROM hotel_info_request_events e WHERE e.request_id = ${link.id}::uuid
          AND e::text LIKE '%lawn seats%') AS events,
        (SELECT count(*) FROM audit_events a WHERE a::text LIKE '%lawn seats%') AS audits,
        (SELECT count(*) FROM notifications n WHERE n::text LIKE '%lawn seats%') AS notices`;
    expect(counts).toEqual({ events: 0n, audits: 0n, notices: 0n });
  });

  it("refuses the sixth correction of the day with 429 correctionLimit and Retry-After", async () => {
    const { sessionToken } = await submitted();
    for (let sent = 0; sent < 5; sent += 1) {
      await calls
        .correct(sessionToken, { message: `${MESSAGE} (${sent})`, botToken: "dev-bot-check" })
        .expect(200);
    }
    const over = await calls
      .correct(sessionToken, { message: MESSAGE, botToken: "dev-bot-check" })
      .expect(429);
    expect(over.body.error.message).toBe(HOTEL_FORM_ERRORS.correctionLimit);
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("takes a correction while the request shows its status only, after the merge", async () => {
    const { link, sessionToken } = await submitted();
    await suite.prisma.hotelInfoRequest.update({
      where: { id: link.id },
      data: { status: "merged", statusOnlyUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    await calls.correct(sessionToken, { message: MESSAGE, botToken: "dev-bot-check" }).expect(200);
    const locked = await calls
      .save(sessionToken, "rooms", firstSave({ totalRooms: 1 }))
      .expect(409);
    expect(locked.body.error.message).toBe(HOTEL_FORM_ERRORS.readOnly);
  });

  it("withdraws 7.5 as the contributor's own act, telling the Super Admins alone, in-app", async () => {
    const { link, sessionToken, personId } = await submitted();
    const answer = await calls
      .withdraw(sessionToken, { kind: "display_authorisation", requestRemoval: false })
      .expect(200);
    expect(answer.body.data).toEqual({
      withdrawn: ["display_authorisation"],
      removalRequested: false,
    });
    const consents = await suite.prisma.hotelInfoRequestConsent.findMany({ where: { personId } });
    const display = consents.find((row) => row.kind === "display_authorisation");
    expect(display).toMatchObject({ withdrawalSource: "contributor", withdrawnByUserId: null });
    expect(display?.withdrawnAt).not.toBeNull();
    expect(consents.find((row) => row.kind === "privacy_notice")?.withdrawnAt).toBeNull();
    const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
      where: { requestId: link.id, eventType: "consent_withdrawn" },
    });
    expect(event.detail).toEqual({ kind: "display_authorisation" });
    const notices = await suite.prisma.notification.findMany({
      where: { entityId: link.id, templateKey: "system.hotel_form_withdrawal" },
    });
    expect(notices.every((row) => row.channel === "in_app")).toBe(true);
    expect(await recipientRolesOf(link.id, "system.hotel_form_withdrawal")).toEqual([
      "super_admin",
    ]);
  });

  it("withdraws every consent, asks once for removal and ends the person's sessions, all at once", async () => {
    const { link, sessionToken, personId } = await submitted();
    const other = await signIn(suite, link.secret, await mobileOf(personId, link));
    const answer = await calls
      .withdraw(sessionToken, { kind: "all", requestRemoval: true })
      .expect(200);
    expect(answer.body.data).toEqual({
      withdrawn: ["privacy_notice", "accuracy_attestation", "display_authorisation"],
      removalRequested: true,
    });
    const live = await suite.prisma.hotelInfoRequestConsent.count({
      where: { personId, withdrawnAt: null },
    });
    expect(live).toBe(0);
    for (const token of [sessionToken, other.sessionToken]) {
      const ended = await calls.draft(token).expect(401);
      expect(ended.body.error.details).toEqual([{ path: "reason", message: "session_ended" }]);
    }
    await calls.withdraw(sessionToken, { kind: "all", requestRemoval: true }).expect(401);
    const events = await suite.prisma.hotelInfoRequestEvent.findMany({
      where: { requestId: link.id, eventType: { in: ["consent_withdrawn", "removal_requested"] } },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.map((row) => [row.eventType, row.detail])).toEqual([
      ["consent_withdrawn", { kind: "all" }],
      ["removal_requested", null],
    ]);
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: personId, entityType: "hotel_info_request_person", action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.afterJson).toMatchObject({
      kinds: ["privacy_notice", "accuracy_attestation", "display_authorisation"],
      changedFields: ["withdrawnAt", "withdrawalSource", "removalRequested", "sessionEndedAt"],
    });
  });

  it("no longer names a person who withdrew every consent to colleagues, until a new code", async () => {
    const { link, sessionToken, personId } = await submitted();
    const colleague = await signIn(suite, link.secret, freshMobile(), {
      fullName: "E2E Synthetic Colleague",
    });
    await calls.withdraw(sessionToken, { kind: "all", requestRemoval: false }).expect(200);
    const seen = (await calls.draft(colleague.sessionToken).expect(200)).body.data;
    expect(seen.contributors).toEqual([
      { fullName: null, designation: null, isYou: false },
      { fullName: "E2E Synthetic Colleague", designation: "General Manager", isYou: true },
    ]);
    expect(seen.sections.property.lastEditedBy).toBeNull();
    expect(seen.sections.property.lastEditedAt).not.toBeNull();
    expect(seen.request.submittedBy).toBeNull();
    const locked = await calls.save(colleague.sessionToken, "rooms", firstSave({ totalRooms: 2 }));
    expect(locked.status).toBe(409);
    expect(hotelFormReadOnlyOf(appErrorOf(locked.body))?.submittedBy).toBeNull();
    await signIn(suite, link.secret, await mobileOf(personId, link));
    const named = (await calls.draft(colleague.sessionToken).expect(200)).body.data;
    expect(named.contributors[0]).toMatchObject({ fullName: "E2E Synthetic Person" });
    expect(named.sections.property.lastEditedBy).toBe("E2E Synthetic Person");
  });

  it("answers a conflict with a colleague who withdrew every consent without their name", async () => {
    const link = await testLink(suite);
    const mine = await signIn(suite, link.secret, freshMobile());
    await calls.save(mine.sessionToken, "contact", firstSave(CONTACT)).expect(200);
    await calls.withdraw(mine.sessionToken, { kind: "all", requestRemoval: false }).expect(200);
    const colleague = await signIn(suite, link.secret, freshMobile());
    const changed = { contacts: [{ name: "E2E Another Person", phone: "+917000099999" }] };
    const conflict = await calls.save(colleague.sessionToken, "contact", firstSave(changed));
    expect(conflict.status).toBe(409);
    const theirs = hotelFormSectionConflictOf(appErrorOf(conflict.body), "contact");
    expect(theirs?.editedBy).toBeNull();
  });
});
