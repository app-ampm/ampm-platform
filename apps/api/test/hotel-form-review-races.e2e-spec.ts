import { createHash } from "node:crypto";

import {
  AppError,
  canonicalJson,
  HOTEL_FORM_ERRORS,
  hotelFormRevisionAnswersOf,
  hotelFormSectionsChangedOf,
} from "@ampm/core";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import {
  HotelFormSubmissionsRepository,
  type NewRevision,
} from "../src/modules/hotels/hotel-form/hotel-form-submissions.repository.js";
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
 * What a submit sees, end to end (D-190 §3, and as decided after the reviews), against the test database:
 * the section versions the review page read, so a colleague's later save is 409 sectionsChanged and never
 * declared accurate unseen, a repeat included; and the request's row lock, which orders every save against
 * a submit. To show the lock rather than hope for an interleaving, the submit is held between its read of
 * the sections and its commit (its revision's write waits on a gate this suite opens): a save sent then
 * waits on the lock, and once the submit commits it is refused readOnly. Without the lock the save would
 * have committed inside the submit, answered 200, and the revision would not hold it. Synthetic data only.
 */

/** Holds a submit between its read of the sections and its commit while armed. */
class GatedSubmissions extends HotelFormSubmissionsRepository {
  private gate: { readonly entered: () => void; readonly open: Promise<void> } | null = null;

  /** Arms the gate: the next revision's write waits for the returned `open()`. */
  arm(): { readonly entered: Promise<void>; readonly open: () => void } {
    let entered = (): void => undefined;
    let open = (): void => undefined;
    const reached = new Promise<void>((resolve) => (entered = resolve));
    const opened = new Promise<void>((resolve) => (open = resolve));
    this.gate = { entered, open: opened };
    return { entered: reached, open };
  }

  override async createRevision(revision: NewRevision, tx: Prisma.TransactionClient) {
    const gate = this.gate;
    this.gate = null;
    if (gate !== null) {
      gate.entered();
      await gate.open;
    }
    return super.createRevision(revision, tx);
  }
}

describe("A submit against the sections its review page read (e2e)", () => {
  let suite: FormSuite;
  let gated: GatedSubmissions;
  const calls = draftCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-races-", {
      customise: (builder) =>
        builder.overrideProvider(HotelFormSubmissionsRepository).useFactory({
          factory: (prisma: PrismaService) => new GatedSubmissions(prisma),
          inject: [PrismaService],
        }),
    });
    const repository = suite.app.get(HotelFormSubmissionsRepository);
    if (!(repository instanceof GatedSubmissions)) throw new Error("The gate is not in place");
    gated = repository;
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

  /** A request ready to submit, its first person's session and a colleague's. */
  async function ready(): Promise<{ link: IssuedLink; mine: string; theirs: string }> {
    const link = await testLink(suite);
    const mine = await signIn(suite, link.secret, freshMobile());
    await calls.save(mine.sessionToken, "property", firstSave(PROPERTY)).expect(200);
    await calls.save(mine.sessionToken, "contact", firstSave(CONTACT)).expect(200);
    const theirs = await signIn(suite, link.secret, freshMobile(), { fullName: "E2E Colleague" });
    return { link, mine: mine.sessionToken, theirs: theirs.sessionToken };
  }

  /** Whether any backend is waiting on a lock now: a save held behind the request's row lock. */
  async function aSaveWaitsOnALock(): Promise<boolean> {
    for (let tries = 0; tries < 50; tries += 1) {
      const [row] = await suite.prisma.$queryRaw<{ waiting: bigint }[]>`
        SELECT count(*) AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if ((row?.waiting ?? 0n) > 0n) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  }

  /** The SHA-256 of the sections as they stand, as a revision of them would be hashed. */
  async function sectionsHashOf(requestId: string): Promise<string> {
    const rows = await suite.prisma.hotelInfoRequestSection.findMany({
      where: { requestId, deletedAt: null },
    });
    const saved = Object.fromEntries(
      rows.map((row) => [
        row.sectionKey,
        { schemaVersion: row.schemaVersion, noChanges: row.noChanges, answers: row.answers },
      ]),
    );
    return createHash("sha256")
      .update(canonicalJson(hotelFormRevisionAnswersOf(saved)))
      .digest("hex");
  }

  it("refuses with 409 sectionsChanged a submit whose review page read the sections before a colleague's save", async () => {
    const { link, mine, theirs } = await ready();
    const read = await calls.reviewedBody(mine);
    const changed = { contacts: [{ name: "E2E Colleague's Contact", email: "c@hotel.example" }] };
    await calls
      .save(theirs, "contact", { answers: changed, expectedVersion: 1, noChanges: false })
      .expect(200);
    const refused = await calls.submit(mine, read).expect(409);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.sectionsChanged);
    expect(hotelFormSectionsChangedOf(refusalOf(refused))).toEqual(["contact"]);
    const declared = await suite.prisma.hotelInfoRequestConsent.count({
      where: { person: { requestId: link.id }, revisionHash: { not: null } },
    });
    expect(declared).toBe(0);
    // Read again, as the page does after the 409, the same person submits what they now see.
    await calls.submit(mine, await calls.reviewedBody(mine)).expect(200);
  });

  it("refuses a stale review page's repeat after a resubmit, so its declarations never cover unseen answers", async () => {
    const { link, mine, theirs } = await ready();
    const read = await calls.reviewedBody(mine);
    await calls.submit(mine, read).expect(200);
    await suite.prisma.hotelInfoRequest.update({
      where: { id: link.id },
      data: { status: "changes_requested" },
    });
    const rooms = { totalRooms: 12 };
    await calls.save(theirs, "rooms", firstSave(rooms)).expect(200);
    await calls.submit(theirs, await calls.reviewedBody(theirs)).expect(200);
    const stale = await calls.submit(mine, read).expect(409);
    expect(stale.body.error.message).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
    expect(
      await suite.prisma.hotelInfoRequestRevision.count({ where: { requestId: link.id } }),
    ).toBe(2);
  });

  it("holds a save sent while a submit is between its read and its commit, then refuses it readOnly", async () => {
    const { link, mine, theirs } = await ready();
    const gate = gated.arm();
    const submitting = calls.submit(mine, await calls.reviewedBody(mine)).then((r) => r);
    await gate.entered;
    const change = { contacts: [{ name: "E2E Late Contact", email: "late@hotel.example" }] };
    const saving = calls
      .save(theirs, "contact", { answers: change, expectedVersion: 1, noChanges: false })
      .then((r) => r);
    expect(await aSaveWaitsOnALock()).toBe(true);
    gate.open();
    const [submitted, saved] = await Promise.all([submitting, saving]);
    expect(submitted.status).toBe(200);
    expect(saved.status).toBe(409);
    expect(saved.body.error.message).toBe(HOTEL_FORM_ERRORS.readOnly);
    const contact = await suite.prisma.hotelInfoRequestSection.findFirstOrThrow({
      where: { requestId: link.id, sectionKey: "contact" },
    });
    expect(contact.version).toBe(1);
    const revision = await suite.prisma.hotelInfoRequestRevision.findFirstOrThrow({
      where: { requestId: link.id },
    });
    expect(revision.answersHash).toBe(await sectionsHashOf(link.id));
    expect(JSON.stringify(revision.answers)).not.toContain("E2E Late Contact");
  });

  it("holds a first save of a section never saved behind a submit the same way, creating no row", async () => {
    const { link, mine, theirs } = await ready();
    const gate = gated.arm();
    const submitting = calls.submit(mine, await calls.reviewedBody(mine)).then((r) => r);
    await gate.entered;
    const saving = calls.save(theirs, "rooms", firstSave({ totalRooms: 9 })).then((r) => r);
    expect(await aSaveWaitsOnALock()).toBe(true);
    gate.open();
    const [submitted, saved] = await Promise.all([submitting, saving]);
    expect(submitted.status).toBe(200);
    expect(saved.status).toBe(409);
    expect(saved.body.error.message).toBe(HOTEL_FORM_ERRORS.readOnly);
    const rooms = await suite.prisma.hotelInfoRequestSection.count({
      where: { requestId: link.id, sectionKey: "rooms" },
    });
    expect(rooms).toBe(0);
  });

  it("never lets a save that answered 200 race past a submit that answered 200, under a burst", async () => {
    const { link, mine, theirs } = await ready();
    const read = await calls.reviewedBody(mine);
    const burst = await Promise.all([
      calls.submit(mine, read).then((r) => r),
      ...[2, 3, 4, 5, 6].map((nights) =>
        calls.save(theirs, "booking_terms", firstSave({ minNights: nights })).then((r) => r),
      ),
    ]);
    const [submit, ...saves] = burst;
    const savedAny = saves.some((response) => response.status === 200);
    // A save that committed first moved a version the review page read: the submit says so instead.
    expect(submit?.status).toBe(savedAny ? 409 : 200);
    if (submit?.status === 200) {
      expect(saves.every((response) => response.status === 409)).toBe(true);
      const terms = await suite.prisma.hotelInfoRequestSection.count({
        where: { requestId: link.id, sectionKey: "booking_terms" },
      });
      expect(terms).toBe(0);
    } else {
      expect(submit?.body.error.message).toBe(HOTEL_FORM_ERRORS.sectionsChanged);
    }
  });
});
