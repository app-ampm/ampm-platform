import { describe, expect, it } from "vitest";

import { fieldNoteUpsert, fieldNoteView } from "./field-note";

const ID = "0192f3a0-7d3e-7b1a-9c2f-123456789abc";
const PROJECT_ID = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";

describe("fieldNoteUpsert", () => {
  it("accepts a valid offline write", () => {
    const parsed = fieldNoteUpsert.parse({
      id: ID,
      baseVersion: 1,
      body: "Catering van at gate 3",
      status: "open",
      clientTimestamp: "2026-10-27T05:00:00.000Z",
    });
    expect(parsed.baseVersion).toBe(1);
  });

  it("accepts a create at base version 0", () => {
    const parsed = fieldNoteUpsert.parse({
      id: ID,
      baseVersion: 0,
      body: "New note, never synced",
      status: "open",
      clientTimestamp: "2026-10-27T05:00:00.000Z",
    });
    expect(parsed.baseVersion).toBe(0);
  });

  it("rejects an empty body and a negative base version", () => {
    expect(() =>
      fieldNoteUpsert.parse({
        id: ID,
        baseVersion: -1,
        body: "",
        status: "open",
        clientTimestamp: "2026-10-27T05:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("fieldNoteView", () => {
  it("strips unknown fields from the server view", () => {
    const parsed = fieldNoteView.parse({
      id: ID,
      projectId: PROJECT_ID,
      version: 2,
      body: "Resolved",
      status: "resolved",
      clientTimestamp: "2026-10-27T05:00:00.000Z",
      serverTimestamp: "2026-10-27T05:01:00.000Z",
      internalNote: "never",
    });
    expect(parsed).not.toHaveProperty("internalNote");
  });
});
