import { createHash } from "node:crypto";

import { hotelInfoRequestCreateRequest } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import {
  buildIssueService as build,
  DESTINATION_ID,
  everythingWritten,
  HOTEL_ID,
  REQUEST_ID,
  SITE,
} from "./testing/info-request-fixtures.js";

/*
 * Creating a hotel information request (D-188 §3 and §4): for an existing hotel or a proposed new one; one
 * live request per hotel and per web address (409); a test request only from the Super Admin and only for
 * a draft or new hotel; the link answered once, and stored only as its hash.
 */

const HT = staffPrincipal(["HT"]);
const SA = staffPrincipal(["SA"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const existing = (extra: Record<string, unknown> = {}) =>
  hotelInfoRequestCreateRequest.parse({ target: "existing", hotelId: HOTEL_ID, ...extra });
const proposed = (extra: Record<string, unknown> = {}) =>
  hotelInfoRequestCreateRequest.parse({
    target: "new",
    proposedName: "Synthetic Lake Palace",
    proposedDestinationId: DESTINATION_ID,
    proposedWebAddress: "HTTP://www.Synthetic-Lake-Palace.example/",
    ...extra,
  });

/** The data the create wrote. */
function created(repo: ReturnType<typeof build>["repo"]): unknown {
  const call = repo.create.mock.calls[0];
  if (!call) throw new Error("nothing was created");
  return call[0];
}

const uniqueViolation = (index: string) =>
  new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on the index \`${index}\``, {
    code: "P2002",
    clientVersion: "7.10.1",
  });

describe("HotelInfoRequestIssueService.create for an existing hotel", () => {
  it("locks the hotel, draws the reference and answers the link once, storing only its hash", async () => {
    const fakes = build();
    const answer = await fakes.service.create(existing({ displayLabel: "Spring refresh" }), HT);
    expect(fakes.repo.lockLiveHotel).toHaveBeenCalledWith(HOTEL_ID, expect.anything());
    const secret = answer.link.url.replace(`${SITE}/hotel-form#k=`, "");
    expect(secret).toMatch(/^hfl_[A-Za-z0-9_-]{43}$/);
    const data = created(fakes.repo);
    expect(data).toMatchObject({
      reference: "HIR-2026-0007",
      kind: "onboarding",
      target: "existing",
      hotelId: HOTEL_ID,
      status: "open",
      isTest: false,
      displayLabel: "Spring refresh",
      tokenGeneration: 1,
      tokenHash: createHash("sha256").update(secret).digest("hex"),
      createdBy: HT.userId,
    });
    expect(everythingWritten({ repo: fakes.repo, journal: fakes.journal })).not.toContain(secret);
    expect(answer).toMatchObject({ request: { id: REQUEST_ID }, email: "not_requested" });
  });

  it("expires the link linkValidityDays after creation, and records the first expiry in its event", async () => {
    const fakes = build({ policy: { linkValidityDays: 14 } });
    const before = Date.now();
    const answer = await fakes.service.create(existing(), HT);
    const expiresAt = Date.parse(answer.link.expiresAt);
    expect(expiresAt - before).toBeGreaterThanOrEqual(14 * DAY_MS);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(14 * DAY_MS);
    expect(fakes.journal.event).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "created",
        detail: { generation: 1, expiresAt: answer.link.expiresAt },
      }),
      expect.anything(),
    );
  });

  it("audits the link's issue with the action share, naming no recipient and no link", async () => {
    const fakes = build();
    await fakes.service.create(existing({ recipientEmail: "sales@synthetic-hotel.example" }), HT);
    expect(fakes.journal.record).toHaveBeenCalledWith(
      REQUEST_ID,
      expect.objectContaining({
        action: "share",
        after: expect.objectContaining({ issued: "created" }),
      }),
      expect.anything(),
    );
    const audit = JSON.stringify(fakes.journal.record.mock.calls);
    expect(audit).not.toContain("sales@synthetic-hotel.example");
    expect(audit).not.toContain("hfl_");
  });

  it("emails the link through the mailer, with the label, reference, expiry and generation", async () => {
    const fakes = build();
    fakes.mailer.sendLink.mockResolvedValueOnce("queued");
    const body = existing({ recipientEmail: "sales@synthetic-hotel.example", emailIt: true });
    const answer = await fakes.service.create(body, HT);
    expect(answer.email).toBe("queued");
    expect(fakes.mailer.sendLink).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: REQUEST_ID,
        reference: "HIR-2026-0007",
        hotelName: "Synthetic Lake Hotel",
        recipientEmail: "sales@synthetic-hotel.example",
        url: answer.link.url,
        generation: 1,
        isTest: false,
      }),
      true,
      { kind: "staff", userId: HT.userId },
    );
  });

  it("refuses a second live request for the hotel with 409, naming the live one", async () => {
    const fakes = build();
    fakes.repo.findLiveForHotel.mockResolvedValueOnce({
      id: REQUEST_ID,
      reference: "HIR-2026-0003",
      status: "submitted",
    });
    await expect(fakes.service.create(existing(), HT)).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("HIR-2026-0003"),
    });
    expect(fakes.repo.create).not.toHaveBeenCalled();
  });

  it("maps the live-request unique indexes to 409 when two creates race, and lets other errors through", async () => {
    for (const index of [
      "hotel_info_requests_hotel_live_key",
      "hotel_info_requests_web_address_live_key",
    ]) {
      const fakes = build();
      fakes.repo.create.mockRejectedValueOnce(uniqueViolation(index));
      await expect(fakes.service.create(existing(), HT), index).rejects.toMatchObject({
        code: "conflict",
      });
    }
    const fakes = build();
    fakes.repo.create.mockRejectedValueOnce(uniqueViolation("hotel_info_requests_token_hash_key"));
    await expect(fakes.service.create(existing(), HT)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("refuses an unknown or deleted hotel with 400 on hotelId", async () => {
    const fakes = build();
    fakes.repo.lockLiveHotel.mockResolvedValueOnce(null);
    await expect(fakes.service.create(existing(), HT)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "hotelId" }],
    });
  });
});

describe("HotelInfoRequestIssueService.create for a new hotel", () => {
  it("keys the proposed address without its scheme, and proposes the name in the destination", async () => {
    const fakes = build();
    await fakes.service.create(proposed(), HT);
    expect(created(fakes.repo)).toMatchObject({
      target: "new",
      hotelId: null,
      proposedName: "Synthetic Lake Palace",
      proposedDestinationId: DESTINATION_ID,
      proposedWebAddress: "HTTP://www.Synthetic-Lake-Palace.example/",
      proposedWebAddressKey: "synthetic-lake-palace.example",
    });
    expect(fakes.repo.findLiveForAddress).toHaveBeenCalledWith(
      "synthetic-lake-palace.example",
      expect.anything(),
    );
  });

  it("refuses an address a live request already proposes (409) and an unknown destination (400)", async () => {
    const taken = build();
    taken.repo.findLiveForAddress.mockResolvedValueOnce({
      id: REQUEST_ID,
      reference: "HIR-2026-0004",
      status: "open",
    });
    await expect(taken.service.create(proposed(), HT)).rejects.toMatchObject({ code: "conflict" });
    const nowhere = build();
    nowhere.repo.findDestination.mockResolvedValueOnce(null);
    await expect(nowhere.service.create(proposed(), HT)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "proposedDestinationId" }],
    });
  });
});

describe("test requests", () => {
  it("are the Super Admin's alone: anyone else is refused with 403 before anything is written", async () => {
    const fakes = build({ hotelStatus: "draft" });
    await expect(fakes.service.create(existing({ isTest: true }), HT)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(fakes.repo.transaction).not.toHaveBeenCalled();
  });

  it("go only to a draft hotel or a new hotel", async () => {
    const active = build({ hotelStatus: "active" });
    await expect(active.service.create(existing({ isTest: true }), SA)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "isTest" }],
    });
    const draft = build({ hotelStatus: "draft" });
    await draft.service.create(existing({ isTest: true }), SA);
    expect(created(draft.repo)).toMatchObject({ isTest: true });
    const fresh = build();
    await fresh.service.create(proposed({ isTest: true }), SA);
    expect(created(fresh.repo)).toMatchObject({ isTest: true, target: "new" });
  });
});
