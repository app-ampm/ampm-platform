import { hotelFormSessionRefusalOf } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import {
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  formConfig,
  formRequests,
  inFormRequest,
  linkedRequest,
  refusalOf,
} from "../testing/hotel-form-fixtures.js";
import { HotelFormGate } from "./hotel-form-gate.js";
import { hashSessionToken, mintSessionToken } from "./hotel-form-session-rules.js";
import type {
  HotelFormSessionsRepository,
  SessionRecord,
} from "./hotel-form-sessions.repository.js";
import { HotelFormSessions } from "./hotel-form-sessions.service.js";

/*
 * Authenticating a form session (D-189 §5), as HotelFormSessionGuard does on every session route: the
 * mode read fresh (off is 404), the Bearer token found by its SHA-256 and compared in constant time, every
 * re-check (hotel-form-session-checks.spec.ts has each one), last_seen at most once a minute, and the
 * hotel-form actor set for audit. Sign-out ends the session.
 */

const MINUTE = 60_000;
const CHALLENGE_ID = "0192f1a0-0000-7000-8000-0000000000c1";
const { token, hash } = mintSessionToken();

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const { tokenHash: _stored, ...request } = linkedRequest();
  return {
    challengeId: CHALLENGE_ID,
    requestId: FORM_REQUEST_ID,
    linkGeneration: 1,
    tokenHash: hash,
    startedAt: new Date(FORM_NOW.getTime() - 30 * MINUTE),
    lastSeenAt: new Date(FORM_NOW.getTime() - 5 * MINUTE),
    endedAt: null,
    person: {
      id: FORM_PERSON_ID,
      fullName: "Stored Person",
      designation: "General Manager",
      isGone: false,
    },
    request,
    ...overrides,
  };
}

function build(stored: SessionRecord | null = record(), mode: "on" | "off" | "test_only" = "on") {
  const repository = {
    findByTokenHash: vi.fn(async () => stored),
    touch: vi.fn(async () => undefined),
    endSession: vi.fn(async () => true),
  };
  const { typed } = formRequests();
  const audit = { record: vi.fn(async () => undefined) };
  const sessions = new HotelFormSessions(
    new HotelFormGate(formConfig({ mode }), typed),
    repository as unknown as HotelFormSessionsRepository,
    typed,
    audit as unknown as AuditService,
  );
  return { sessions, repository, audit };
}

const BEARER = `Bearer ${token}`;
const authenticate = (built: ReturnType<typeof build>, header: string | undefined) =>
  inFormRequest(() => built.sessions.authenticate(header, FORM_NOW));

describe("HotelFormSessions.authenticate", () => {
  it("answers the session's person, request and state, and makes the person the request's actor", async () => {
    const built = build();
    const { result, context } = await authenticate(built, BEARER);
    expect(built.repository.findByTokenHash).toHaveBeenCalledWith(hashSessionToken(token));
    expect(result).toEqual({
      challengeId: CHALLENGE_ID,
      requestId: FORM_REQUEST_ID,
      personId: FORM_PERSON_ID,
      person: { fullName: "Stored Person", designation: "General Manager" },
      request: record().request,
      state: "ready",
    });
    expect(context).toMatchObject({
      hotelFormActor: { requestId: FORM_REQUEST_ID, personId: FORM_PERSON_ID },
    });
  });

  it("answers 404 while the mode is off, before reading the token", async () => {
    const built = build(record(), "off");
    expect((await refusalOf(authenticate(built, undefined)))?.status).toBe(404);
    expect(built.repository.findByTokenHash).not.toHaveBeenCalled();
  });

  it("refuses no token, a malformed one, or one naming no session, as no_session", async () => {
    for (const header of [undefined, "Bearer hfs_short", `Basic ${token}`]) {
      const refused = await refusalOf(authenticate(build(), header));
      expect(refused?.status).toBe(401);
      expect(refused && hotelFormSessionRefusalOf(refused)).toBe("no_session");
    }
    const unknown = await refusalOf(authenticate(build(null), BEARER));
    expect(unknown && hotelFormSessionRefusalOf(unknown)).toBe("no_session");
  });

  it("refuses a stored hash that does not match in constant time", async () => {
    const refused = await refusalOf(
      authenticate(build(record({ tokenHash: "0".repeat(64) })), BEARER),
    );
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("no_session");
  });

  it("refuses with the re-check's reason, writing nothing", async () => {
    const built = build(record({ linkGeneration: 0 }));
    const refused = await refusalOf(authenticate(built, BEARER));
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("link_changed");
    expect(built.repository.touch).not.toHaveBeenCalled();
    const expired = build(record({ lastSeenAt: new Date(FORM_NOW.getTime() - 2 * 60 * MINUTE) }));
    const timedOut = await refusalOf(authenticate(expired, BEARER));
    expect(timedOut && hotelFormSessionRefusalOf(timedOut)).toBe("session_expired");
  });

  it("re-checks the mode as read now: test_only refuses a request that is not a test", async () => {
    const { tokenHash: _stored, ...real } = linkedRequest({ isTest: false });
    const refused = await refusalOf(
      authenticate(build(record({ request: real }), "test_only"), BEARER),
    );
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("not_active");
  });

  it("writes last_seen at most once a minute", async () => {
    const stale = build();
    await authenticate(stale, BEARER);
    expect(stale.repository.touch).toHaveBeenCalledWith(CHALLENGE_ID, FORM_PERSON_ID, FORM_NOW);
    const fresh = build(record({ lastSeenAt: new Date(FORM_NOW.getTime() - 20_000) }));
    await authenticate(fresh, BEARER);
    expect(fresh.repository.touch).not.toHaveBeenCalled();
  });
});

describe("HotelFormSessions.signOut", () => {
  it("ends the session and audits it as the person", async () => {
    const built = build();
    const { result: session } = await authenticate(built, BEARER);
    const { result } = await inFormRequest(() => built.sessions.signOut(session, FORM_NOW));
    expect(result).toEqual({ ok: true });
    expect(built.repository.endSession).toHaveBeenCalledWith(CHALLENGE_ID, FORM_NOW, FORM_TX);
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "update",
        entityType: "hotel_form_session",
        entityId: CHALLENGE_ID,
        after: { id: CHALLENGE_ID, personId: FORM_PERSON_ID, changedFields: ["sessionEndedAt"] },
      },
      FORM_TX,
    );
  });
});
