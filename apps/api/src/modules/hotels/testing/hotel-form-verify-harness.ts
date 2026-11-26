import {
  HOTEL_FORM_NOTICE_VERSION,
  type HotelFormPhotoPermission,
  type HotelFormPolicy,
} from "@ampm/core";
import { vi } from "vitest";

import { hashOneTimeCode } from "../../../identity/one-time-code.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import type {
  ChallengeClaim,
  ChallengeRow,
  HotelFormChallengesRepository,
} from "../hotel-form/hotel-form-challenges.repository.js";
import { HotelFormCodeVerifier } from "../hotel-form/hotel-form-code-verifier.service.js";
import { HotelFormEnrolment } from "../hotel-form/hotel-form-enrolment.service.js";
import { HotelFormGate } from "../hotel-form/hotel-form-gate.js";
import type {
  HotelFormPeopleRepository,
  PersonRow,
} from "../hotel-form/hotel-form-people.repository.js";
import type { LinkedRequest } from "../hotel-form/hotel-form-requests.repository.js";
import type {
  HotelFormSessionsRepository,
  OpenSession,
} from "../hotel-form/hotel-form-sessions.repository.js";
import {
  FORM_IP,
  FORM_KEYS,
  FORM_LINK,
  FORM_MOBILE,
  FORM_NOW,
  FORM_PERSON_ID,
  formConfig,
  formRequests,
  inFormRequest,
  linkedRequest,
} from "./hotel-form-fixtures.js";

/*
 * The verifier's unit harness (D-189 §2, §4 and §5): the real gate, verifier and enrolment over fake
 * repositories, journal and audit, with a challenge whose code is CODE. Test-only: the build leaves
 * `testing/` folders out.
 */

export const CHALLENGE_ID = "0192f1a0-0000-7000-8000-0000000000c1";
export const CODE = "042137";

/** The claim a challenge holds until its code is entered. */
export const CLAIM: ChallengeClaim = {
  fullName: "Synthetic Claimant",
  designation: "Sales Manager",
  phone: FORM_MOBILE,
  noticeVersion: HOTEL_FORM_NOTICE_VERSION,
};

/** A person the request already has, with their stored details. */
export const STORED: PersonRow = {
  id: FORM_PERSON_ID,
  fullName: "Stored Person",
  designation: "General Manager",
};

export interface VerifyOptions {
  readonly policy?: Partial<HotelFormPolicy>;
  readonly found?: LinkedRequest | null;
  readonly locked?: LinkedRequest | null;
  readonly challenge?: Partial<ChallengeRow> | null;
  readonly reserved?: boolean;
  readonly claim?: ChallengeClaim | null;
  readonly used?: boolean;
  readonly live?: PersonRow | null;
  readonly removed?: boolean;
  readonly people?: number;
  readonly sessions?: OpenSession[];
  /** A returning person's own answer to 7.5 as their consents hold it. */
  readonly photoPermission?: HotelFormPhotoPermission;
}

function fakeChallenges(options: VerifyOptions) {
  const challenge: ChallengeRow | null =
    options.challenge === null
      ? null
      : {
          id: CHALLENGE_ID,
          linkGeneration: 1,
          delivery: "screen",
          codeHmac: hashOneTimeCode(CHALLENGE_ID, CODE, FORM_KEYS.hotelFormCode),
          ...options.challenge,
        };
  return {
    find: vi.fn(async () => challenge),
    reserveTry: vi.fn(async () => options.reserved ?? true),
    retireIfSpent: vi.fn(async () => true),
    lockClaim: vi.fn(async () => (options.claim === undefined ? CLAIM : options.claim)),
    markUsed: vi.fn(async () => options.used ?? true),
  };
}

function fakePeople(options: VerifyOptions) {
  return {
    findLive: vi.fn(async () => options.live ?? null),
    wasRemoved: vi.fn(async () => options.removed ?? false),
    countLive: vi.fn(async () => options.people ?? 0),
    create: vi.fn(async (person: { fullName: string; designation: string }) => ({
      id: FORM_PERSON_ID,
      fullName: person.fullName,
      designation: person.designation,
    })),
    markReturning: vi.fn(async () => undefined),
    addNoticeConsent: vi.fn(async () => undefined),
    photoPermissionOf: vi.fn(async () => options.photoPermission ?? "none"),
  };
}

/** The verifier and its enrolment over the fakes, with the fakes to inspect. */
export function buildVerifier(options: VerifyOptions = {}) {
  const found = options.found === undefined ? linkedRequest() : options.found;
  const locked = options.locked === undefined ? found : options.locked;
  const { repository, typed } = formRequests(found, locked);
  const challenges = fakeChallenges(options);
  const people = fakePeople(options);
  const sessions = {
    openSessionsOf: vi.fn(async () => options.sessions ?? []),
    endSessions: vi.fn(async () => undefined),
  };
  const journal = { event: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const enrolment = new HotelFormEnrolment(
    typed,
    challenges as unknown as HotelFormChallengesRepository,
    people as unknown as HotelFormPeopleRepository,
    sessions as unknown as HotelFormSessionsRepository,
    journal as unknown as HotelInfoRequestJournal,
    audit as unknown as AuditService,
  );
  const gate = new HotelFormGate(formConfig(options.policy), typed);
  const verifier = new HotelFormCodeVerifier(
    gate,
    challenges as unknown as HotelFormChallengesRepository,
    enrolment,
    FORM_KEYS,
  );
  return { verifier, repository, challenges, people, sessions, journal, audit };
}

/** Verifies `code` on the spec link's challenge inside a request's context. */
export const verifyWith = (built: ReturnType<typeof buildVerifier>, code: string = CODE) =>
  inFormRequest(() =>
    built.verifier.verify(
      { token: FORM_LINK.secret, challengeId: CHALLENGE_ID, oneTimeCode: code },
      { ip: FORM_IP, userAgent: null },
      FORM_NOW,
    ),
  );

/** A code that is not CODE: wrong for the spec challenge. */
export const WRONG_CODE = "000000";

/** A person's open session started `hours` ago and seen then. */
export function openSession(id: string, hours: number): OpenSession {
  const at = new Date(FORM_NOW.getTime() - hours * 60 * 60 * 1000);
  return { id, startedAt: at, lastSeenAt: at };
}
