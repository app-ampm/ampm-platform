import { createHash } from "node:crypto";

import {
  AppError,
  canonicalJson,
  HOTEL_FORM_ERRORS,
  hotelFormMissingItemsOf,
  hotelFormReadOnlyOf,
  hotelFormRevisionAnswers,
} from "@ampm/core";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTACT, draftCalls, firstSave, PROPERTY, submitBody } from "./hotel-form-draft-suite.js";
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
 * Submitting the hotel form end to end (D-190 §3 and §4), against the test database: the strict check;
 * revision 1 holding every section and its hash; both declarations bound to that hash under the consents'
 * CHECK; the System's move to submitted with its revision, time and submitter; the `submitted` event; a
 * guest_token audit holding ids, the revision, the hash and the kinds, never an answer; in-app and email
 * notices to the active Super Admin and Hotel team. A repeat answers the same and writes nothing twice;
 * a colleague whose 7.5 differs, or any submit once AMPM moved the request on, is 409 alreadySubmitted;
 * the draft locks, and opens again when changes are asked for. Synthetic data only.
 */
describe("Submitting the hotel form (e2e, D-190 §3)", () => {
  let suite: FormSuite;
  const calls = draftCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-submit-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  const refusalOf = (response: Response) =>
    new AppError(
      response.body.error.code,
      response.body.error.message,
      response.body.error.details,
    );

  /** A request whose draft holds what an onboarding submit needs, and its first person's session. */
  async function readyToSubmit(): Promise<{ link: IssuedLink; sessionToken: string }> {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await calls.save(sessionToken, "property", firstSave(PROPERTY)).expect(200);
    await calls.save(sessionToken, "contact", firstSave(CONTACT)).expect(200);
    return { link, sessionToken };
  }

  /** The active staff who hold the Super Admin or the Hotel team role: who a submit tells. */
  const staffCount = () =>
    suite.prisma.user.count({
      where: {
        userType: "staff",
        status: "active",
        deletedAt: null,
        roles: {
          some: { role: { roleKey: { in: ["super_admin", "hotel_team"] }, deletedAt: null } },
        },
      },
    });

  /** The staff notices of a request, as [template, channel, status]. */
  async function noticesOf(requestId: string): Promise<string[][]> {
    const rows = await suite.prisma.notification.findMany({
      where: { entityId: requestId, templateKey: { startsWith: "system.hotel_form_" } },
      select: { templateKey: true, channel: true, status: true },
    });
    return rows.map((row) => [row.templateKey, row.channel, row.status]).sort();
  }

  it("refuses an incomplete form with 400 submitIncomplete, listing every missing item", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const refused = await calls.submit(sessionToken, submitBody()).expect(400);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.submitIncomplete);
    expect(hotelFormMissingItemsOf(refusalOf(refused)).map((item) => item.field)).toEqual([
      "name",
      "city",
      "state",
      "contacts",
    ]);
    expect(
      await suite.prisma.hotelInfoRequestRevision.count({ where: { requestId: link.id } }),
    ).toBe(0);
  });

  it("writes revision 1, binds both declarations to its hash, moves the request and tells staff", async () => {
    const { link, sessionToken } = await readyToSubmit();
    const answer = await calls
      .submit(sessionToken, await calls.reviewedBody(sessionToken, "no"))
      .expect(200);
    const request = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(answer.body.data).toEqual({
      reference: request.reference,
      status: "submitted",
      submittedAt: request.submittedAt?.toISOString(),
    });
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id },
    });
    expect(request).toMatchObject({
      status: "submitted",
      revision: 1,
      submittedByPersonId: person.id,
    });
    const revision = await suite.prisma.hotelInfoRequestRevision.findFirstOrThrow({
      where: { requestId: link.id },
    });
    const answers = hotelFormRevisionAnswers.parse(revision.answers);
    expect(answers.property.answers).toEqual(PROPERTY);
    expect(answers.rooms).toEqual({ schemaVersion: 1, noChanges: false, answers: {} });
    const hash = createHash("sha256").update(canonicalJson(revision.answers)).digest("hex");
    expect(revision).toMatchObject({
      revision: 1,
      answersHash: hash,
      submittedByPersonId: person.id,
    });
    expect(revision.files).toEqual([]);
    const declarations = await suite.prisma.hotelInfoRequestConsent.findMany({
      where: { personId: person.id, kind: { not: "privacy_notice" } },
      orderBy: { kind: "asc" },
    });
    expect(declarations.map((row) => [row.kind, row.granted, row.revisionHash])).toEqual([
      ["accuracy_attestation", true, hash],
      ["display_authorisation", false, hash],
    ]);
    const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
      where: { requestId: link.id, eventType: "submitted" },
    });
    expect(event).toMatchObject({ actorKind: "hotel_person", actorPersonId: person.id });
    expect(event.detail).toEqual({ revision: 1 });
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: link.id, entityType: "hotel_info_request", actorType: "guest_token" },
    });
    expect(audit.actorRef).toBe(`hir:${link.id}/person:${person.id}`);
    expect(audit.afterJson).toMatchObject({
      id: link.id,
      revisionId: revision.id,
      revision: 1,
      answersHash: hash,
      kinds: ["accuracy_attestation", "display_authorisation"],
    });
    expect(JSON.stringify(audit)).not.toContain("Lake Palace");
    const staff = await staffCount();
    const notices = await suite.prisma.notification.findMany({
      where: { entityId: link.id, templateKey: { startsWith: "system.hotel_form_" } },
    });
    expect(await noticesOf(link.id)).toEqual(
      [
        ...Array<string[]>(staff).fill(["system.hotel_form_submitted", "email", "sent"]),
        ...Array<string[]>(staff).fill(["system.hotel_form_submitted", "in_app", "delivered"]),
      ].sort(),
    );
    expect(notices.every((row) => row.recipientType === "user")).toBe(true);
    expect(JSON.stringify(notices)).not.toMatch(/Lake Palace|synthetic-hotel/);
  });

  it("answers a repeat, or a colleague who agrees, with the same answer, writing nothing twice", async () => {
    const { link, sessionToken } = await readyToSubmit();
    const body = await calls.reviewedBody(sessionToken);
    const first = await calls.submit(sessionToken, body).expect(200);
    const again = await calls.submit(sessionToken, body).expect(200);
    expect(again.body.data).toEqual(first.body.data);
    const colleague = await signIn(suite, link.secret, freshMobile(), {
      fullName: "E2E Colleague",
    });
    const agrees = await calls.reviewedBody(colleague.sessionToken);
    const theirs = await calls.submit(colleague.sessionToken, agrees).expect(200);
    expect(theirs.body.data).toEqual(first.body.data);
    expect(
      await suite.prisma.hotelInfoRequestRevision.count({ where: { requestId: link.id } }),
    ).toBe(1);
    const submitted = await suite.prisma.hotelInfoRequestEvent.count({
      where: { requestId: link.id, eventType: "submitted" },
    });
    expect(submitted).toBe(1);
    const notices = await suite.prisma.notification.count({
      where: { entityId: link.id, templateKey: "system.hotel_form_submitted" },
    });
    expect(notices).toBe((await staffCount()) * 2);
  });

  it("refuses a colleague whose 7.5 differs, and any submit once AMPM moved it on: 409 alreadySubmitted", async () => {
    const { link, sessionToken } = await readyToSubmit();
    await calls.submit(sessionToken, await calls.reviewedBody(sessionToken, "yes")).expect(200);
    const colleague = await signIn(suite, link.secret, freshMobile(), {
      fullName: "E2E Colleague",
    });
    const no = await calls.reviewedBody(colleague.sessionToken, "no");
    const differs = await calls.submit(colleague.sessionToken, no).expect(409);
    expect(differs.body.error.message).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
    expect(hotelFormReadOnlyOf(refusalOf(differs))).toMatchObject({
      status: "submitted",
      submittedBy: "E2E Synthetic Person",
    });
    // A reviewer claims it (8b's move, made directly here).
    await suite.prisma.hotelInfoRequest.update({
      where: { id: link.id },
      data: { status: "in_review" },
    });
    const moved = await calls
      .submit(sessionToken, await calls.reviewedBody(sessionToken, "yes"))
      .expect(409);
    expect(hotelFormReadOnlyOf(refusalOf(moved))?.status).toBe("in_review");
    expect(
      await suite.prisma.hotelInfoRequestRevision.count({ where: { requestId: link.id } }),
    ).toBe(1);
  });

  it("locks the draft once submitted, and submits revision 2 after changes are asked for", async () => {
    const { link, sessionToken } = await readyToSubmit();
    await calls.submit(sessionToken, await calls.reviewedBody(sessionToken)).expect(200);
    const locked = await calls
      .save(sessionToken, "rooms", firstSave({ totalRooms: 40 }))
      .expect(409);
    expect(locked.body.error.message).toBe(HOTEL_FORM_ERRORS.readOnly);
    expect(hotelFormReadOnlyOf(refusalOf(locked))).toMatchObject({
      status: "submitted",
      submittedBy: "E2E Synthetic Person",
    });
    await suite.prisma.hotelInfoRequest.update({
      where: { id: link.id },
      data: { status: "changes_requested" },
    });
    await calls.save(sessionToken, "rooms", firstSave({ totalRooms: 40 })).expect(200);
    await calls.submit(sessionToken, await calls.reviewedBody(sessionToken)).expect(200);
    const request = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(request).toMatchObject({ status: "submitted", revision: 2 });
    const revisions = await suite.prisma.hotelInfoRequestRevision.findMany({
      where: { requestId: link.id },
      orderBy: { revision: "asc" },
    });
    expect(revisions.map((row) => row.revision)).toEqual([1, 2]);
    expect(revisions[0]?.answersHash).not.toBe(revisions[1]?.answersHash);
  });

  it("refuses older declaration words with 409 noticeStale, and a missing bot pass with 400", async () => {
    const { link, sessionToken } = await readyToSubmit();
    const stale = await calls.reviewedBody(sessionToken, "yes", {
      accuracy: { accepted: true, textVersion: "hf-accuracy-2020-01-01" },
    });
    const refused = await calls.submit(sessionToken, stale).expect(409);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.noticeStale);
    const unpassed = await calls.reviewedBody(sessionToken, "yes", { botToken: undefined });
    const noPass = await calls.submit(sessionToken, unpassed);
    expect(noPass.status).toBe(400);
    expect(noPass.body.error.details).toEqual([
      { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck },
    ]);
    const unticked = submitBody("yes", { accuracy: { accepted: false, textVersion: "x" } });
    await calls.submit(sessionToken, unticked).expect(400);
    expect(
      await suite.prisma.hotelInfoRequestRevision.count({ where: { requestId: link.id } }),
    ).toBe(0);
  });
});
