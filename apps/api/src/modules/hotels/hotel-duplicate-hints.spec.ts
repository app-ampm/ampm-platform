import { describe, expect, it } from "vitest";

import { duplicateHints, nameTokens, type HintCandidate } from "./hotel-duplicate-hints.js";

/*
 * The duplicate hints of the Invite a new hotel sheet (D-188 §3; plan §4.1): catalogue hotels whose name
 * or name variant matches the name typed (case and accents ignored), whose website is the address typed,
 * or whose website is on its host; deleted hotels included; twenty at most, strongest first.
 */

let sequence = 0;
function hotel(overrides: Partial<HintCandidate> = {}): HintCandidate {
  sequence += 1;
  return {
    id: `0192f1a0-0000-7000-8000-${String(sequence).padStart(12, "0")}`,
    name: `Synthetic Hotel ${sequence}`,
    status: "active",
    nameAliases: null,
    website: null,
    deletedAt: null,
    destination: { name: "Synthetic Coast" },
    ...overrides,
  };
}

const reasonsOf = (hints: ReturnType<typeof duplicateHints>, id: string) =>
  hints.find((hint) => hint.hotelId === id)?.reasons;

describe("nameTokens", () => {
  it("drops case, accents, punctuation and the words every hotel name carries", () => {
    expect(nameTokens("  The Hôtel Le CAFÉ-Bleu & Spa ")).toEqual(["le", "cafe", "bleu"]);
    // Escapes, never the characters: an editor that composes text would make the two one.
    expect(nameTokens("Café Lake")).toEqual(nameTokens("Café Lake"));
    expect(nameTokens("The Resort")).toEqual([]);
  });
});

describe("duplicateHints", () => {
  it("matches a name whatever its case and accents, and a name that holds or is held by it", () => {
    const exact = hotel({ name: "Hôtel Le Café Bleu" });
    const longer = hotel({ name: "Synthetic Lake Palace Udaipur" });
    const other = hotel({ name: "Synthetic Lake View" });
    const hints = duplicateHints([exact, longer, other], { name: "hotel le cafe bleu" });
    expect(hints.map((hint) => hint.hotelId)).toEqual([exact.id]);
    const partial = duplicateHints([exact, longer, other], { name: "Lake Palace" });
    expect(partial.map((hint) => hint.hotelId)).toEqual([longer.id]);
    expect(reasonsOf(partial, longer.id)).toEqual(["name"]);
  });

  it("matches a hotel's name variants", () => {
    const aliased = hotel({ name: "Synthetic Fort", nameAliases: ["Rose Fort Palace", "RFP"] });
    const hints = duplicateHints([aliased], { name: "rose fort palace" });
    expect(reasonsOf(hints, aliased.id)).toEqual(["name_variant"]);
  });

  it("matches a website by its key, the scheme, www., query and trailing slash ignored", () => {
    const same = hotel({ website: "https://www.synthetic-lake.example/?utm=1" });
    const sameHost = hotel({ website: "https://synthetic-lake.example/udaipur" });
    const hints = duplicateHints([same, sameHost], { webAddress: "http://synthetic-lake.example" });
    expect(reasonsOf(hints, same.id)).toEqual(["web_address"]);
    expect(reasonsOf(hints, sameHost.id)).toEqual(["website_host"]);
    expect(hints.map((hint) => hint.hotelId)).toEqual([same.id, sameHost.id]);
  });

  it("flags a host two or more live hotels share as weak evidence, a brand's domain", () => {
    const first = hotel({ website: "https://brand.example/jaipur" });
    const second = hotel({ website: "https://brand.example/udaipur" });
    const own = hotel({ website: "https://own-hotel.example" });
    const hints = duplicateHints([first, second, own], { webAddress: "brand.example/goa" });
    expect(hints.map((hint) => [hint.hotelId, hint.sharedHost])).toEqual([
      [first.id, true],
      [second.id, true],
    ]);
    const alone = duplicateHints([own], { webAddress: "own-hotel.example/rooms" });
    expect(alone[0]?.sharedHost).toBe(false);
  });

  it("includes deleted hotels, with when they were deleted", () => {
    const deleted = hotel({
      website: "https://synthetic-old.example",
      deletedAt: new Date("2026-11-01T00:00:00.000Z"),
      status: "inactive",
    });
    const [hint] = duplicateHints([deleted], { webAddress: "synthetic-old.example" });
    expect(hint).toEqual({
      hotelId: deleted.id,
      name: deleted.name,
      status: "inactive",
      destinationName: "Synthetic Coast",
      website: "https://synthetic-old.example",
      deletedAt: "2026-11-01T00:00:00.000Z",
      reasons: ["web_address"],
      sharedHost: false,
    });
  });

  it("names every reason a hotel matches, and puts the strongest first, twenty at most", () => {
    const many = Array.from({ length: 25 }, (_, index) => hotel({ name: `Lake Retreat ${index}` }));
    const both = hotel({ name: "Lake Retreat", website: "https://lake-retreat.example" });
    const hints = duplicateHints([...many, both], {
      name: "Lake Retreat",
      webAddress: "lake-retreat.example",
    });
    expect(hints).toHaveLength(20);
    expect(hints[0]).toMatchObject({ hotelId: both.id, reasons: ["name", "web_address"] });
  });

  it("gives no hints for nothing typed, generic words alone or an address it cannot read", () => {
    const candidates = [hotel({ name: "The Grand Resort", website: "https://grand.example" })];
    expect(duplicateHints(candidates, {})).toEqual([]);
    expect(duplicateHints(candidates, { name: "The Resort" })).toEqual([]);
    expect(duplicateHints(candidates, { name: "g" })).toEqual([]);
    expect(duplicateHints(candidates, { webAddress: "not an address" })).toEqual([]);
  });
});
