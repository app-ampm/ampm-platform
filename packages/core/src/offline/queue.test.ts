import { describe, expect, it } from "vitest";

import {
  dedupeByIdempotency,
  idempotencyKey,
  orderForReplay,
  toUpsertBody,
  type QueuedMutation,
} from "./queue";

function mutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    sequence: 1,
    recordId: "0192f3a0-7d3e-7b1a-9c2f-000000000001",
    baseVersion: 1,
    body: "Stage-left riser is wobbling",
    status: "open",
    clientTimestamp: "2026-10-27T05:00:00.000Z",
    ...overrides,
  };
}

describe("offline change queue", () => {
  it("replays in the device's enqueue order regardless of insertion order", () => {
    const ordered = orderForReplay([
      mutation({ sequence: 3 }),
      mutation({ sequence: 1 }),
      mutation({ sequence: 2 }),
    ]);
    expect(ordered.map((m) => m.sequence)).toEqual([1, 2, 3]);
  });

  it("keys idempotency on the client id and the base version", () => {
    expect(idempotencyKey({ recordId: "note-a", baseVersion: 2 })).toBe("note-a:2");
  });

  it("collapses a double-enqueue of the same write but keeps a genuine next edit", () => {
    const first = mutation({ sequence: 1, baseVersion: 1 });
    const accidentalDuplicate = mutation({ sequence: 2, baseVersion: 1 });
    const nextEdit = mutation({ sequence: 3, baseVersion: 2, body: "Riser fixed" });
    const sendable = dedupeByIdempotency([first, accidentalDuplicate, nextEdit]);
    expect(sendable.map((m) => m.sequence)).toEqual([1, 3]);
  });

  it("builds the request body from a queued mutation", () => {
    const body = toUpsertBody(mutation({ recordId: "note-r", baseVersion: 4 }));
    expect(body).toMatchObject({ id: "note-r", baseVersion: 4, status: "open" });
  });
});
