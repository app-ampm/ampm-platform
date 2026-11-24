import { describe, expect, it } from "vitest";

import { versionChains, type VersionLink } from "./document-versions.js";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 24, 10, minute));
const row = (id: string, previousVersionId: string | null, minute: number): VersionLink => ({
  id,
  previousVersionId,
  createdAt: at(minute),
});

const ids = (chains: ReturnType<typeof versionChains>) =>
  chains.map((chain) => [chain.latest.id, chain.earlier.map((version) => version.id)]);

describe("versionChains: an owner's live documents, each with its earlier versions (D-187 §6)", () => {
  it("lists a document with no replacement on its own", () => {
    expect(ids(versionChains([row("a1", null, 1)]))).toEqual([["a1", []]]);
  });

  it("lists the latest version, with the versions it replaced newest first", () => {
    const rows = [row("a1", null, 1), row("a3", "a2", 3), row("a2", "a1", 2)];
    expect(ids(versionChains(rows))).toEqual([["a3", ["a2", "a1"]]]);
  });

  it("lists separate documents newest first", () => {
    const rows = [row("a1", null, 1), row("b1", null, 5), row("a2", "a1", 2)];
    expect(ids(versionChains(rows))).toEqual([
      ["b1", []],
      ["a2", ["a1"]],
    ]);
  });

  it("stops a chain at a version that is not in the list (removed, or another owner's)", () => {
    expect(ids(versionChains([row("a2", "gone", 2)]))).toEqual([["a2", []]]);
  });

  it("never lists a version twice, even if two versions follow the same one", () => {
    const rows = [row("a1", null, 1), row("a2", "a1", 2), row("b2", "a1", 3)];
    const chains = versionChains(rows);
    expect(ids(chains)).toEqual([
      ["b2", ["a1"]],
      ["a2", []],
    ]);
  });
});
