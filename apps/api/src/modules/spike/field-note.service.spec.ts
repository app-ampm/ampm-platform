import { type FieldNoteUpsert } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { FieldNoteService } from "./field-note.service.js";

const PROJECT = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
const OTHER_PROJECT = "0192f3a0-7d3e-7b1a-9c2f-bbbbbbbbbbbb";
const NOTE_ID = "0192f3a0-7d3e-7b1a-9c2f-000000000001";
const AT = "2026-10-27T05:00:00.000Z";

function write(overrides: Partial<FieldNoteUpsert> = {}): FieldNoteUpsert {
  return {
    id: NOTE_ID,
    baseVersion: 0,
    body: "Catering van at gate 3",
    status: "open",
    clientTimestamp: AT,
    ...overrides,
  };
}

describe("FieldNoteService (offline spike)", () => {
  it("creates at version 1, then applies the next edit in order", () => {
    const service = new FieldNoteService();
    const created = service.upsert(PROJECT, write({ baseVersion: 0 }));
    expect(created.outcome).toBe("applied");
    expect(created.note.version).toBe(1);

    const edited = service.upsert(PROJECT, write({ baseVersion: 1, body: "Van unloaded" }));
    expect(edited.outcome).toBe("applied");
    expect(edited.note.version).toBe(2);
    expect(edited.note.body).toBe("Van unloaded");
  });

  it("is idempotent: replaying the same write never applies twice", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }));
    const replay = service.upsert(PROJECT, write({ baseVersion: 0, body: "ignored on replay" }));
    expect(replay.outcome).toBe("duplicate");
    expect(replay.note.version).toBe(1);
    expect(replay.note.body).toBe("Catering van at gate 3");
    expect(service.list(PROJECT).items).toHaveLength(1);
  });

  it("rejects a stale base version: the server wins and the record is unchanged", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0, body: "Original" }));
    const stale = service.upsert(
      PROJECT,
      write({ baseVersion: 2, body: "From an out-of-date device" }),
    );
    expect(stale.outcome).toBe("conflict");
    expect(stale.note.version).toBe(1);
    expect(stale.note.body).toBe("Original");
  });

  it("keeps notes isolated per project", () => {
    const service = new FieldNoteService();
    service.upsert(PROJECT, write({ baseVersion: 0 }));
    expect(service.list(OTHER_PROJECT).items).toHaveLength(0);
  });
});
