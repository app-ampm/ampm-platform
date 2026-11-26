import { AppError, hotelFormSessionRefusalOf } from "@ampm/core";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { HotelFormSubmissionsRepository } from "../src/modules/hotels/hotel-form/hotel-form-submissions.repository.js";
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
 * A session ended while one of its calls was already past the guard (D-190 §3, review fix D1), end to end
 * against the test database. A person with two sessions withdraws every consent in one: that ends both
 * sessions and takes back their privacy notice consent, under the request's lock, so nothing more is
 * written as them. A submit, a save or a correction the other session sent just before has passed the
 * guard already; to show the re-check under the lock rather than hope for an interleaving, that call is
 * held just before it takes the lock (the gate below) while the withdrawal commits, then let go. It must
 * answer 401 session_ended and write nothing. Synthetic data only.
 */

/** Holds the next call that takes a request's lock, just before it takes it, while armed. */
class GatedLocks extends HotelFormSubmissionsRepository {
  private gate: { readonly entered: () => void; readonly open: Promise<void> } | null = null;

  /** Arms the gate: the next call to take a request's lock waits for the returned `open()`. */
  arm(): { readonly entered: Promise<void>; readonly open: () => void } {
    let entered = (): void => undefined;
    let open = (): void => undefined;
    const reached = new Promise<void>((resolve) => (entered = resolve));
    const opened = new Promise<void>((resolve) => (open = resolve));
    this.gate = { entered, open: opened };
    return { entered: reached, open };
  }

  override async lock(requestId: string, tx: Prisma.TransactionClient) {
    const gate = this.gate;
    this.gate = null;
    if (gate !== null) {
      gate.entered();
      await gate.open;
    }
    return super.lock(requestId, tx);
  }
}

describe("A call past the guard whose session ended under the request's lock (e2e)", () => {
  let suite: FormSuite;
  let gated: GatedLocks;
  const calls = draftCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-session-races-", {
      customise: (builder) =>
        builder.overrideProvider(HotelFormSubmissionsRepository).useFactory({
          factory: (prisma: PrismaService) => new GatedLocks(prisma),
          inject: [PrismaService],
        }),
    });
    const repository = suite.app.get(HotelFormSubmissionsRepository);
    if (!(repository instanceof GatedLocks)) throw new Error("The gate is not in place");
    gated = repository;
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  const reasonOf = (response: Response) =>
    hotelFormSessionRefusalOf(
      new AppError(
        response.body.error.code,
        response.body.error.message,
        response.body.error.details,
      ),
    );

  /** A request ready to submit, and two sessions of one person: the one that withdraws, and the other. */
  async function twoSessions(): Promise<{ link: IssuedLink; withdrawing: string; other: string }> {
    const link = await testLink(suite);
    const mobile = freshMobile();
    const first = await signIn(suite, link.secret, mobile);
    await calls.save(first.sessionToken, "property", firstSave(PROPERTY)).expect(200);
    await calls.save(first.sessionToken, "contact", firstSave(CONTACT)).expect(200);
    const second = await signIn(suite, link.secret, mobile);
    return { link, withdrawing: first.sessionToken, other: second.sessionToken };
  }

  /** Holds `call` before the lock, withdraws every consent in `withdrawing`, then lets `call` go on. */
  async function heldThroughWithdrawal(
    withdrawing: string,
    call: () => Promise<Response>,
  ): Promise<Response> {
    const gate = gated.arm();
    const held = call().then((response) => response);
    await gate.entered;
    await calls.withdraw(withdrawing, { kind: "all", requestRemoval: false }).expect(200);
    gate.open();
    return held;
  }

  it("refuses with 401 session_ended a submit held past its guard while the person withdrew every consent", async () => {
    const { link, withdrawing, other } = await twoSessions();
    const body = await calls.reviewedBody(other);
    const refused = await heldThroughWithdrawal(withdrawing, () => calls.submit(other, body));
    expect(refused.status).toBe(401);
    expect(reasonOf(refused)).toBe("session_ended");
    expect(
      await suite.prisma.hotelInfoRequestRevision.count({ where: { requestId: link.id } }),
    ).toBe(0);
    const declarations = await suite.prisma.hotelInfoRequestConsent.count({
      where: { person: { requestId: link.id }, revisionHash: { not: null } },
    });
    expect(declarations).toBe(0);
    const request = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({
      where: { id: link.id },
      select: { status: true, revision: true },
    });
    expect(request).toEqual({ status: "open", revision: 0 });
  });

  it("refuses with 401 session_ended a save held past its guard the same way, writing no section", async () => {
    const { link, withdrawing, other } = await twoSessions();
    const refused = await heldThroughWithdrawal(withdrawing, () =>
      calls.save(other, "rooms", firstSave({ totalRooms: 9 })),
    );
    expect(refused.status).toBe(401);
    expect(reasonOf(refused)).toBe("session_ended");
    const rooms = await suite.prisma.hotelInfoRequestSection.count({
      where: { requestId: link.id, sectionKey: "rooms" },
    });
    expect(rooms).toBe(0);
  });

  it("refuses with 401 session_ended a correction held past its guard the same way, storing nothing", async () => {
    const { link, withdrawing, other } = await twoSessions();
    await calls.submit(withdrawing, await calls.reviewedBody(withdrawing)).expect(200);
    const message = { message: "E2E synthetic correction", botToken: "dev-bot-check" };
    const refused = await heldThroughWithdrawal(withdrawing, () => calls.correct(other, message));
    expect(refused.status).toBe(401);
    expect(reasonOf(refused)).toBe("session_ended");
    const corrections = await suite.prisma.hotelInfoRequestCorrection.count({
      where: { requestId: link.id },
    });
    expect(corrections).toBe(0);
  });

  it("still lets the other session's calls through when the person withdrew only 7.5", async () => {
    const { link, withdrawing, other } = await twoSessions();
    const gate = gated.arm();
    const saving = calls.save(other, "rooms", firstSave({ totalRooms: 9 })).then((r) => r);
    await gate.entered;
    const display = { kind: "display_authorisation", requestRemoval: false };
    await calls.withdraw(withdrawing, display).expect(200);
    gate.open();
    expect((await saving).status).toBe(200);
    const rooms = await suite.prisma.hotelInfoRequestSection.count({
      where: { requestId: link.id, sectionKey: "rooms" },
    });
    expect(rooms).toBe(1);
  });
});
