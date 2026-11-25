import type { HotelInfoRequestStatus } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import { requestContext } from "../../common/request-context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import type { HotelInfoRequestJournal } from "./hotel-info-request-journal.js";
import { HOTEL_DELETED_REASON, HotelInfoRequestRevoker } from "./hotel-info-request-revoker.js";
import type { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * Revoking a hotel information request (D-188 §2 and §3; permission-matrix §7 lines 505 and 506): SA and
 * HT revoke an open request or one awaiting changes, with a reason; the System revokes a deleted hotel's
 * live request, whatever its live status. Each writes its event and audit in the change's transaction.
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";
const HOTEL_ID = "0192f1a0-0000-7000-8000-0000000000a1";
const HT = staffPrincipal(["HT"]);
// The fakes never touch the client: any object stands for the transaction.
const TX = {} as unknown as Prisma.TransactionClient;

function build(
  live: { id: string; reference: string; status: HotelInfoRequestStatus } | null = null,
) {
  const repo = {
    updateIf: vi.fn(async () => 1),
    lockHotel: vi.fn(async () => undefined),
    findLiveForHotel: vi.fn(async () => live),
    // The request as read under its row's lock: by default as findLiveForHotel saw it.
    lockById: vi.fn(
      async (): Promise<{ id: string; status: HotelInfoRequestStatus } | null> =>
        live && { id: live.id, status: live.status },
    ),
  };
  const principals: (string | undefined)[] = [];
  const journal = {
    event: vi.fn(async () => undefined),
    record: vi.fn(async () => {
      principals.push(requestContext.principal()?.type);
    }),
  };
  const revoker = new HotelInfoRequestRevoker(
    repo as unknown as HotelInfoRequestsRepository,
    journal as unknown as HotelInfoRequestJournal,
  );
  return { revoker, repo, journal, principals };
}

const request = (status: HotelInfoRequestStatus) => ({ id: REQUEST_ID, status });

describe("HotelInfoRequestRevoker.revokeByStaff", () => {
  it("revokes an open request or one awaiting changes, with the reason, its event and its audit", async () => {
    for (const status of ["open", "changes_requested"] as const) {
      const { revoker, repo, journal } = build();
      await revoker.revokeByStaff(request(status), "Sent to the wrong hotel", HT, TX);
      expect(repo.updateIf).toHaveBeenCalledWith(
        REQUEST_ID,
        { statuses: [status] },
        expect.objectContaining({
          status: "revoked",
          revokedAt: expect.any(Date),
          revokeReason: "Sent to the wrong hotel",
          updatedBy: HT.userId,
        }),
        TX,
      );
      expect(journal.event).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "revoked",
          actor: { kind: "staff", userId: HT.userId },
          detail: { fromStatus: status, cause: "staff" },
        }),
        TX,
      );
      expect(journal.record).toHaveBeenCalledWith(
        REQUEST_ID,
        { action: "update", before: { status }, after: { status: "revoked", cause: "staff" } },
        TX,
      );
    }
  });

  it("refuses with 409 a request staff can never revoke: in review, submitted, or already final", async () => {
    for (const status of ["submitted", "in_review", "merged", "rejected", "revoked"] as const) {
      const { revoker, repo } = build();
      await expect(
        revoker.revokeByStaff(request(status), "No", HT, TX),
        status,
      ).rejects.toMatchObject({ code: "conflict" });
      expect(repo.updateIf).not.toHaveBeenCalled();
    }
  });

  it("refuses with 403 a principal the §7 row does not name, a custom role with the update key", async () => {
    const custom = staffPrincipal([], ["hotels.info_requests.update:all"]);
    const { revoker, repo } = build();
    await expect(revoker.revokeByStaff(request("open"), "No", custom, TX)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(repo.updateIf).not.toHaveBeenCalled();
  });

  it("refuses with 409 when the request moved meanwhile, writing no event", async () => {
    const { revoker, repo, journal } = build();
    repo.updateIf.mockResolvedValueOnce(0);
    await expect(revoker.revokeByStaff(request("open"), "No", HT, TX)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(journal.event).not.toHaveBeenCalled();
  });
});

describe("HotelInfoRequestRevoker.revokeForDeletedHotel", () => {
  it("does nothing for a hotel without a live request, after locking the hotel's row", async () => {
    const { revoker, repo } = build(null);
    await revoker.revokeForDeletedHotel(HOTEL_ID, TX);
    expect(repo.lockHotel).toHaveBeenCalledWith(HOTEL_ID, TX);
    expect(repo.updateIf).not.toHaveBeenCalled();
  });

  it("revokes the live request as the System, whatever its live status, audited as the System", async () => {
    for (const status of ["open", "submitted", "in_review", "changes_requested"] as const) {
      const { revoker, repo, journal, principals } = build({
        id: REQUEST_ID,
        reference: "HIR-2026-0001",
        status,
      });
      await requestContext.run({ requestId: "r-1", ip: null, principal: HT, access: null }, () =>
        revoker.revokeForDeletedHotel(HOTEL_ID, TX),
      );
      const write = repo.updateIf.mock.calls[0] as unknown as [
        string,
        unknown,
        Record<string, unknown>,
      ];
      expect(write[2]).toMatchObject({ status: "revoked", revokeReason: HOTEL_DELETED_REASON });
      expect(write[2]).not.toHaveProperty("updatedBy");
      expect(journal.event).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "revoked",
          actor: { kind: "system" },
          detail: { fromStatus: status, cause: "hotel_deleted" },
        }),
        TX,
      );
      expect(principals, status).toEqual(["system"]);
    }
  });

  const open = { id: REQUEST_ID, reference: "HIR-2026-0001", status: "open" } as const;

  it("locks the request's row after the hotel's, and revokes from the status it reads there", async () => {
    const { revoker, repo, journal } = build(open);
    repo.lockById.mockResolvedValueOnce({ id: REQUEST_ID, status: "submitted" });
    await revoker.revokeForDeletedHotel(HOTEL_ID, TX);
    expect(repo.lockById).toHaveBeenCalledWith(REQUEST_ID, TX);
    expect(repo.lockHotel.mock.invocationCallOrder[0]).toBeLessThan(
      repo.lockById.mock.invocationCallOrder[0] ?? 0,
    );
    expect(repo.updateIf).toHaveBeenCalledWith(
      REQUEST_ID,
      { statuses: ["submitted"] },
      expect.objectContaining({ status: "revoked" }),
      TX,
    );
    expect(journal.event).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { fromStatus: "submitted", cause: "hotel_deleted" } }),
      TX,
    );
  });

  it("leaves a request staff revoked meanwhile as it is, and lets the deletion go on", async () => {
    for (const latest of [{ id: REQUEST_ID, status: "revoked" as const }, null]) {
      const { revoker, repo, journal } = build(open);
      repo.lockById.mockResolvedValueOnce(latest);
      await expect(revoker.revokeForDeletedHotel(HOTEL_ID, TX)).resolves.toBeUndefined();
      expect(repo.updateIf).not.toHaveBeenCalled();
      expect(journal.event).not.toHaveBeenCalled();
      expect(journal.record).not.toHaveBeenCalled();
    }
  });

  it("treats a guarded write that matched no row as already revoked, not an error", async () => {
    const { revoker, repo, journal } = build(open);
    repo.updateIf.mockResolvedValueOnce(0);
    await expect(revoker.revokeForDeletedHotel(HOTEL_ID, TX)).resolves.toBeUndefined();
    expect(journal.event).not.toHaveBeenCalled();
    expect(journal.record).not.toHaveBeenCalled();
  });
});
