import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../generated/prisma/client.js";
import type { AuditService } from "../../policy/audit.service.js";
import { HotelInfoRequestJournal, SYSTEM_ACTOR } from "./hotel-info-request-journal.js";
import type { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * A request event names its actor by kind and id (D-188 §1; D-189 §6): a member of staff by user, the
 * System by nothing, and a hotel person by their person row, which no code request has yet.
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";
const AT = new Date("2026-11-25T10:00:00.000Z");
const tx = {} as Prisma.TransactionClient;

function build() {
  const addEvent = vi.fn(async () => undefined);
  const journal = new HotelInfoRequestJournal(
    { addEvent } as unknown as HotelInfoRequestsRepository,
    { record: vi.fn() } as unknown as AuditService,
  );
  return { journal, addEvent };
}

describe("HotelInfoRequestJournal.event", () => {
  it("writes a hotel person's event with their person and no user", async () => {
    const { journal, addEvent } = build();
    const personId = "0192f1a0-0000-7000-8000-0000000000d1";
    await journal.event(
      {
        requestId: REQUEST_ID,
        eventType: "person_verified",
        actor: { kind: "hotel_person", personId },
        at: AT,
        detail: { returning: false },
      },
      tx,
    );
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "person_verified",
        actorKind: "hotel_person",
        actorUserId: null,
        actorPersonId: personId,
        createdBy: null,
        updatedBy: null,
      }),
      tx,
    );
  });

  it("writes a claimant's code request as a hotel person's, with no person yet", async () => {
    const { journal, addEvent } = build();
    await journal.event(
      {
        requestId: REQUEST_ID,
        eventType: "code_requested",
        actor: { kind: "hotel_person", personId: null },
        at: AT,
      },
      tx,
    );
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKind: "hotel_person",
        actorPersonId: null,
        actorUserId: null,
      }),
      tx,
    );
  });

  it("keeps staff and the System as they were", async () => {
    const { journal, addEvent } = build();
    const userId = "0192f1a0-0000-7000-8000-0000000000e1";
    await journal.event(
      { requestId: REQUEST_ID, eventType: "updated", actor: { kind: "staff", userId }, at: AT },
      tx,
    );
    await journal.event(
      { requestId: REQUEST_ID, eventType: "revoked", actor: SYSTEM_ACTOR, at: AT },
      tx,
    );
    expect(addEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ actorKind: "staff", actorUserId: userId, actorPersonId: null }),
      tx,
    );
    expect(addEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ actorKind: "system", actorUserId: null, actorPersonId: null }),
      tx,
    );
  });
});
