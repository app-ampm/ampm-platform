import { CONFIG_REGISTRY } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import type { ConfigService } from "../admin/config/config.service.js";
import type { HotelInfoRequestJournal } from "./hotel-info-request-journal.js";
import { HotelInfoRequestReader } from "./hotel-info-request-reader.js";
import type { HotelInfoRequestRevoker } from "./hotel-info-request-revoker.js";
import type { HotelInfoRequestsRepository, RequestRow } from "./hotel-info-requests.repository.js";
import { HotelInfoRequestsService } from "./hotel-info-requests.service.js";
import { toRequestSummary } from "./hotel-info-requests.view.js";
import { REQUEST_ID, requestRow } from "./testing/info-request-fixtures.js";

/*
 * Changing a hotel information request (D-188 §3): the label, note and recipient, an extension capped
 * at maxExtensionDays past the first expiry, a recorded share and the revoke; each with its event in the
 * change's transaction, and its audit.
 */

const HT = staffPrincipal(["HT"]);
const TX = {} as unknown as Prisma.TransactionClient;
const FIRST_EXPIRY = new Date("2099-01-31T10:00:00.000Z");
const DESTINATION_ID = "0192f1a0-0000-7000-8000-0000000000a2";
/** A live new-hotel request with no website, in the destination asked for. */
const proposal = {
  id: "0192f1a0-0000-7000-8000-0000000000b9",
  reference: "HIR-2026-0009",
  status: "open" as const,
  isTest: false,
  proposedName: "Synthetic Lake Palace",
  proposedWebAddress: null,
  proposedDestination: { name: "Synthetic Coast" },
};

function build(
  row: RequestRow = requestRow({ expiresAt: FIRST_EXPIRY }),
  firstExtension: unknown = null,
) {
  const repo = {
    transaction: vi.fn(async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => work(TX)),
    findById: vi.fn(async (): Promise<RequestRow | null> => row),
    lockById: vi.fn(async (): Promise<RequestRow | null> => row),
    updateIf: vi.fn(async (..._args: unknown[]): Promise<number> => 1),
    firstExtensionDetail: vi.fn(async (): Promise<unknown> => firstExtension),
    hintCandidates: vi.fn(async () => []),
    liveProposalsIn: vi.fn(async (_destinationId: string) => [proposal]),
  };
  const journal = { event: vi.fn(async () => undefined), record: vi.fn(async () => undefined) };
  const revoker = { revokeByStaff: vi.fn(async () => undefined) };
  const policy = { ...CONFIG_REGISTRY["hotel_form.policy"].default, maxExtensionDays: 60 };
  const config = { get: vi.fn(async () => policy) };
  // The real reader works out the extension limit; only its answer is stubbed.
  const reader = new HotelInfoRequestReader(
    repo as unknown as HotelInfoRequestsRepository,
    config as unknown as ConfigService,
  );
  vi.spyOn(reader, "detail").mockResolvedValue(toRequestSummary(requestRow(), new Date()));
  const service = new HotelInfoRequestsService(
    repo as unknown as HotelInfoRequestsRepository,
    reader,
    journal as unknown as HotelInfoRequestJournal,
    revoker as unknown as HotelInfoRequestRevoker,
  );
  return { service, repo, journal, reader, revoker };
}

describe("HotelInfoRequestsService.duplicateHints", () => {
  it("answers no hints, reading no catalogue, when nothing typed reads as a name or an address", async () => {
    const { service, repo } = build();
    for (const query of [{}, { name: "ab" }, { name: "The Resort" }, { webAddress: "grand" }]) {
      expect(await service.duplicateHints(query), JSON.stringify(query)).toEqual({ hints: [] });
    }
    expect(repo.hintCandidates).not.toHaveBeenCalled();
    await service.duplicateHints({ name: "Synthetic Lake Palace" });
    expect(repo.hintCandidates).toHaveBeenCalledOnce();
    expect(repo.liveProposalsIn).not.toHaveBeenCalled();
  });

  it("names the live requests of the same name in the destination asked for, and only then (D-192)", async () => {
    const { service, repo } = build();
    const asked = { name: "Synthetic Lake Palace", destinationId: DESTINATION_ID };
    const answer = await service.duplicateHints(asked);
    expect(repo.liveProposalsIn).toHaveBeenCalledWith(DESTINATION_ID);
    expect(answer).toEqual({
      hints: [],
      liveRequests: [expect.objectContaining({ reference: "HIR-2026-0009" })],
    });
    expect(await service.duplicateHints({ name: "Synthetic Lake Palace" })).toEqual({ hints: [] });
    const unnamed = { webAddress: "synthetic-lake.example", destinationId: DESTINATION_ID };
    expect(await service.duplicateHints(unnamed)).toEqual({ hints: [], liveRequests: [] });
    expect(await service.duplicateHints({ destinationId: DESTINATION_ID })).toEqual({
      hints: [],
      liveRequests: [],
    });
    expect(repo.liveProposalsIn).toHaveBeenCalledOnce();
  });
});

describe("HotelInfoRequestsService.update", () => {
  it("changes the label, note and recipient, naming the fields changed and never their values", async () => {
    const { service, repo, journal } = build();
    await service.update(
      REQUEST_ID,
      {
        displayLabel: "Lake refresh",
        recipientEmail: "front@synthetic-hotel.example",
        staffNote: null,
      },
      HT,
    );
    expect(repo.updateIf).toHaveBeenCalledWith(
      REQUEST_ID,
      { statuses: ["open"] },
      {
        displayLabel: "Lake refresh",
        recipientEmail: "front@synthetic-hotel.example",
        updatedBy: HT.userId,
      },
      TX,
    );
    const fields = ["displayLabel", "recipientEmail"];
    expect(journal.event).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "updated", detail: { fields } }),
      TX,
    );
    expect(journal.record).toHaveBeenCalledWith(
      REQUEST_ID,
      { action: "update", after: { changedFields: fields } },
      TX,
    );
    expect(JSON.stringify([journal.event.mock.calls, journal.record.mock.calls])).not.toContain(
      "front@synthetic-hotel.example",
    );
  });

  it("writes nothing when every field sent already has its value", async () => {
    const { service, repo, journal, reader } = build();
    await service.update(
      REQUEST_ID,
      { recipientName: "Synthetic Sales Desk", staffNote: null },
      HT,
    );
    expect(repo.updateIf).not.toHaveBeenCalled();
    expect(journal.event).not.toHaveBeenCalled();
    expect(reader.detail).toHaveBeenCalledWith(REQUEST_ID, HT);
  });

  it("extends the expiry, recording from and to, up to maxExtensionDays past the first expiry", async () => {
    const { service, repo, journal } = build();
    await service.update(REQUEST_ID, { extendDays: 30 }, HT);
    const to = new Date("2099-03-02T10:00:00.000Z");
    expect(repo.updateIf).toHaveBeenCalledWith(
      REQUEST_ID,
      { statuses: ["open"] },
      { expiresAt: to, updatedBy: HT.userId },
      TX,
    );
    expect(journal.event).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "expiry_extended",
        detail: { from: FIRST_EXPIRY.toISOString(), to: to.toISOString() },
      }),
      TX,
    );
    expect(journal.record).toHaveBeenCalledWith(
      REQUEST_ID,
      {
        action: "update",
        before: { expiresAt: FIRST_EXPIRY.toISOString() },
        after: { changedFields: ["expiresAt"], expiresAt: to.toISOString() },
      },
      TX,
    );
  });

  it("holds a later extension to the limit of the first expiry, not of the current one", async () => {
    const extended = requestRow({ expiresAt: new Date("2099-03-02T10:00:00.000Z") });
    const { service, repo } = build(extended, { from: FIRST_EXPIRY.toISOString() });
    await expect(service.update(REQUEST_ID, { extendDays: 31 }, HT)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "extendDays" }],
    });
    expect(repo.updateIf).not.toHaveBeenCalled();
    await service.update(REQUEST_ID, { extendDays: 30 }, HT);
    expect(repo.updateIf).toHaveBeenCalledOnce();
  });

  it("refuses with 409 a request that is no longer live, and 404 for none", async () => {
    for (const status of ["merged", "rejected", "revoked"] as const) {
      const { service } = build(requestRow({ status }));
      await expect(
        service.update(REQUEST_ID, { displayLabel: "X" }, HT),
        status,
      ).rejects.toMatchObject({
        code: "conflict",
      });
    }
    const missing = build();
    missing.repo.lockById.mockResolvedValueOnce(null);
    await expect(
      missing.service.update(REQUEST_ID, { displayLabel: "X" }, HT),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("locks the request's row in its transaction before reading it, so it waits for a revoke under way", async () => {
    const { service, repo } = build();
    await service.update(REQUEST_ID, { displayLabel: "Lake refresh" }, HT);
    expect(repo.lockById).toHaveBeenCalledWith(REQUEST_ID, TX);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("refuses with 409 a request revoked by the time its row is locked, writing nothing", async () => {
    const { service, repo, journal } = build();
    repo.lockById.mockResolvedValueOnce(requestRow({ status: "revoked" }));
    await expect(service.update(REQUEST_ID, { staffNote: "Late" }, HT)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.updateIf).not.toHaveBeenCalled();
    expect(journal.event).not.toHaveBeenCalled();
    expect(journal.record).not.toHaveBeenCalled();
  });

  it("refuses with 409, writing no event, when the guarded write finds the request moved", async () => {
    const { service, repo, journal } = build();
    repo.updateIf.mockResolvedValueOnce(0);
    await expect(service.update(REQUEST_ID, { staffNote: "Late" }, HT)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(journal.event).not.toHaveBeenCalled();
  });
});

describe("HotelInfoRequestsService.recordShare", () => {
  it("records the share with its channel and note, audited with the action share", async () => {
    const { service, journal, reader } = build();
    await service.recordShare(REQUEST_ID, { channel: "whatsapp", note: "To the GM" }, HT);
    expect(journal.event).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "share_recorded",
        actor: { kind: "staff", userId: HT.userId },
        detail: { channel: "whatsapp", note: "To the GM" },
      }),
      TX,
    );
    expect(journal.record).toHaveBeenCalledWith(
      REQUEST_ID,
      { action: "share", after: { channel: "whatsapp" } },
      TX,
    );
    expect(reader.detail).toHaveBeenCalledWith(REQUEST_ID, HT);
  });

  it("refuses with 409 a request that is no longer live", async () => {
    const { service, journal } = build(requestRow({ status: "revoked" }));
    await expect(service.recordShare(REQUEST_ID, { channel: "copy" }, HT)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(journal.event).not.toHaveBeenCalled();
  });

  it("locks the request's row first, so a share is never recorded on a request revoked meanwhile", async () => {
    const { service, repo, journal } = build();
    repo.lockById.mockResolvedValueOnce(requestRow({ status: "revoked" }));
    await expect(service.recordShare(REQUEST_ID, { channel: "copy" }, HT)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.lockById).toHaveBeenCalledWith(REQUEST_ID, TX);
    expect(journal.event).not.toHaveBeenCalled();
    expect(journal.record).not.toHaveBeenCalled();
  });
});

describe("HotelInfoRequestsService.revoke", () => {
  it("revokes through the §7 machine in one transaction, with the reason, and answers the request", async () => {
    const { service, revoker, reader } = build();
    await service.revoke(REQUEST_ID, { reason: "Sent to the wrong hotel" }, HT);
    expect(revoker.revokeByStaff).toHaveBeenCalledWith(
      expect.objectContaining({ id: REQUEST_ID, status: "open" }),
      "Sent to the wrong hotel",
      HT,
      TX,
    );
    expect(reader.detail).toHaveBeenCalledWith(REQUEST_ID, HT);
  });

  it("reads the request under its row's lock, and answers 404 for no such request", async () => {
    const { service, repo, revoker } = build();
    await service.revoke(REQUEST_ID, { reason: "Sent to the wrong hotel" }, HT);
    expect(repo.lockById).toHaveBeenCalledWith(REQUEST_ID, TX);
    revoker.revokeByStaff.mockClear();
    repo.lockById.mockResolvedValueOnce(null);
    await expect(service.revoke(REQUEST_ID, { reason: "No" }, HT)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(revoker.revokeByStaff).not.toHaveBeenCalled();
  });
});
