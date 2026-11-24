import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

import { inspectOoxml } from "./ooxml.js";
import { forEachTag } from "./ooxml-parts.js";
import {
  buildPackage,
  type ExtraRelationship,
  TRANSITIONAL_RELS as T,
} from "./testing/ooxml-builder.js";
import { EVERY_KIND } from "./testing/refusals.js";

/*
 * What the OOXML check holds while it runs (D-187 §2): a part it parses whole is read, parsed and let go,
 * and a tag it has no use for is never built. Garbage collection is forced, as Jest's leak detector does,
 * so what is measured is what is still reachable, not what the collector has yet to free.
 */

setFlagsFromString("--expose-gc");
const collectGarbage = runInNewContext("gc") as () => void;

/** Every part the check read whole, held weakly, and a hook that runs before each read. */
const reads = vi.hoisted(() => ({
  parts: [] as WeakRef<Buffer>[],
  before: (_name: string): void => undefined,
}));

vi.mock("./zip-inflate.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./zip-inflate.js")>();
  return {
    ...original,
    readEntry: async (...args: Parameters<typeof original.readEntry>): Promise<Buffer> => {
      reads.before(args[1].name);
      const part = await original.readEntry(...args);
      reads.parts.push(new WeakRef(part));
      return part;
    },
  };
});

describe("inspectOoxml holds one relationship part at a time", () => {
  it("lets each relationship part go once its rules are applied", async () => {
    const sources = Array.from({ length: 40 }, (_, index) => `ppt/slides/slide${index + 2}.xml`);
    const relationships: ExtraRelationship[] = sources.map((source) => ({
      source,
      type: `${T}/image`,
      target: "../media/image1.png",
    }));
    const pkg = buildPackage({ relationships, defaults: { png: "image/png" } });
    const last = "ppt/slides/_rels/slide41.xml.rels";
    let stillHeld = -1;
    reads.parts.length = 0;
    reads.before = (name) => {
      if (name !== last) return;
      collectGarbage();
      stillHeld = reads.parts.filter((part) => part.deref() !== undefined).length;
    };
    await expect(inspectOoxml(pkg, EVERY_KIND)).resolves.toBe("pptx");
    expect(reads.parts.length).toBeGreaterThan(40);
    expect(stillHeld).toBeGreaterThanOrEqual(0);
    expect(stillHeld).toBeLessThanOrEqual(3);
  });
});

describe("forEachTag builds only the tags it is asked for, as it reads them", () => {
  it("reads a 2 MiB part of empty tags holding at most a few times its size", () => {
    const count = 140_000;
    const xml = Buffer.from(`<Relationships>${"<Relationship/>".repeat(count)}</Relationships>`);
    expect(xml.length).toBeGreaterThan(2 * 1024 * 1024);
    collectGarbage();
    const before = process.memoryUsage().heapUsed;
    let seen = 0;
    let held = Number.POSITIVE_INFINITY;
    forEachTag(xml, "_rels/.rels", new Set(["Relationship"]), () => {
      seen += 1;
      if (seen < count) return;
      collectGarbage();
      held = process.memoryUsage().heapUsed - before;
    });
    expect(seen).toBe(count);
    expect(held).toBeLessThan(3 * xml.length);
  });

  it("never builds a tag it was not asked for", () => {
    const xml = Buffer.from(
      `<Types>${"<a/>".repeat(100_000)}<Default Extension="xml" ContentType="application/xml"/></Types>`,
    );
    const seen: string[] = [];
    forEachTag(xml, "[Content_Types].xml", new Set(["Default", "Override"]), (tag) => {
      seen.push(tag.name);
    });
    expect(seen).toEqual(["Default"]);
  });
});
