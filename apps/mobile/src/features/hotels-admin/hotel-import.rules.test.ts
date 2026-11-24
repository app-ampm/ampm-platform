import { staffAccessFor } from "@ampm/api-client";
import { RATE_IMPORT_COLUMNS, type HotelImportResult } from "@ampm/core";

import { staffMeFixture } from "../accounts/accounts.test-utils";
import { changingHeadline, rowOutcomeText } from "./hotel-import.format";
import {
  importableKinds,
  importReportFile,
  importTemplateFile,
  isImportKind,
  kindCount,
} from "./hotel-import.kinds";
import { importReportCsv } from "./hotel-import.report";
import { importRules, PREVIEW_TTL_TEXT } from "./hotel-import.rules";
import { dryRunResult } from "./hotel-import.test-utils";

const VENUES: HotelImportResult = dryRunResult({
  kind: "venues",
  rejected: [{ line: 4, errors: [{ field: "row", message: "Changed since preview" }] }],
  rows: [
    {
      line: 3,
      slug: "synthetic-lake-hotel",
      name: "Synthetic Lawn",
      outcome: "update",
      changedFields: ["setting", "capacityBanquet"],
    },
    {
      line: 4,
      slug: "synthetic-lake-hotel",
      name: "Synthetic Hall",
      outcome: "error",
      changedFields: [],
    },
  ],
});

describe("the import kinds", () => {
  it("offers each kind to the roles whose grants import it, in the picker's order", () => {
    expect(importableKinds(staffAccessFor(staffMeFixture(["HT"])))).toEqual([
      "hotels",
      "rooms",
      "venues",
      "rates",
    ]);
    expect(importableKinds(staffAccessFor(staffMeFixture(["SM"])))).toEqual([]);
    const custom = staffMeFixture([], ["hotels.room_categories_venues.create:all"]);
    expect(importableKinds(staffAccessFor(custom))).toEqual(["rooms", "venues"]);
    const rates = staffMeFixture([], ["hotels.rate_cards_rate_items.create:all"]);
    expect(importableKinds(staffAccessFor(rates))).toEqual(["rates"]);
  });

  it("reads a picker's value, counts in the kind's noun and names its files", () => {
    expect(isImportKind("venues")).toBe(true);
    expect(isImportKind("rates")).toBe(true);
    expect(isImportKind("contacts")).toBe(false);
    expect(kindCount("rooms", 1)).toBe("1 room category");
    expect(kindCount("venues", 3)).toBe("3 venues");
    expect(kindCount("rates", 2)).toBe("2 rate items");
    expect(importTemplateFile("hotels")).toBe("hotels-import-template.csv");
    expect(importTemplateFile("rates")).toBe("rates-import-template.csv");
    expect(importReportFile("rooms")).toBe("rooms-import-report.csv");
  });
});

describe("the import rules", () => {
  it("keeps the hotels' rules: required columns, blanks, lists, yes-or-no, the cap and UTF-8", () => {
    const rules = importRules("hotels").join(" ");
    expect(rules).toContain("Required: destinationSlug, name.");
    expect(rules).toContain("a blank cell leaves its value unchanged");
    expect(rules).toContain("change only when filled");
    expect(rules).toContain('with "|" or a line break; a comma stays inside an entry.');
    expect(rules).toContain("Yes-or-no columns take true or false");
    expect(rules).toContain("totalEventSpaceSqft gives totalEventSpaceSqm");
    expect(rules).toContain("Up to 5 MB and 2,000 rows.");
    expect(rules).toContain("Save the file as CSV UTF-8");
  });

  it("states the rooms' match by name, the unit types and the units rule", () => {
    const rules = importRules("rooms").join(" ");
    expect(rules).toContain("Required: hotelSlug, name.");
    expect(rules).toContain("its room category by name");
    expect(rules).toContain(
      "unitType takes room, suite, villa, cottage, tent, tent_suite, apartment or other",
    );
    expect(rules).toContain("sizeSqft gives sizeSqm");
  });

  it("states the venues' setting, capacities, layouts and the 24 hours a preview keeps", () => {
    const rules = importRules("venues");
    expect(rules[0]).toBe(
      "Required: hotelSlug, name; a new venue also needs venueType and setting.",
    );
    const text = rules.join(" ");
    expect(text).toContain("setting takes indoor, outdoor or semi_open");
    expect(text).toContain("capacityBanquet seated at round tables for dinner");
    expect(text).toContain("Put a range such as 600-700 in capacityNotes.");
    expect(text).toContain("Classroom: 120 | U-shape: 30-40");
    expect(text).toContain("prefunctionAreaSqft gives prefunctionAreaSqm");
    expect(text).toContain(`${PREVIEW_TTL_TEXT}.`);
    expect(PREVIEW_TTL_TEXT).toBe("A preview can be imported for 24 hours");
  });
});

describe("the rates rules", () => {
  const rules = importRules("rates");
  const text = rules.join(" ");

  it("requires the hotel, the card and the item type, and a new item's amount and unit", () => {
    expect(rules[0]).toBe(
      "Required: hotelSlug, cardName, itemType; a new item also needs amount and unit.",
    );
  });

  it("says what each of the template's columns holds", () => {
    for (const column of RATE_IMPORT_COLUMNS) expect(text).toMatch(new RegExp(`\\b${column}\\b`));
    expect(text).toContain("its rate card by name (cardName)");
    expect(text).toContain("minQuantity is the fewest guests or rooms the rate needs");
  });

  it("loads only into draft cards, as hidden items, a card verified on the hotel's Rate cards tab", () => {
    expect(text).toContain("Rates load only into draft cards");
    expect(text).toContain("New items start hidden from clients");
    expect(text).toContain("verified on the hotel's Rate cards tab against a rates verification");
  });

  it("dates a new card by the first of its rows that can be imported, as the API does", () => {
    expect(text).toContain(
      "adds a draft card, dated by the validFrom and validTo (YYYY-MM-DD) of the first of its " +
        "rows that can be imported.",
    );
    expect(text).not.toContain("its first row's validFrom");
  });

  it("refuses a second row for the same item on the same card, so two prices take two cards", () => {
    expect(text).toContain(
      'A second row for the same item on the same card is refused ("Line N already names this ' +
        'item"), so two prices for one room go on separate cards.',
    );
  });

  it("asks for rupees as a number, a range's upper bound in amountMax", () => {
    expect(text).toContain("in rupees as a number, such as 12500 or 12,500.50");
    expect(text).toContain("its upper bound in amountMax");
  });

  it("lists the item types and units as a cell spells them, never a bracketed label", () => {
    expect(text).toContain(
      "itemType takes Room rate, Venue rental, Per plate veg, Per plate non-veg, Wedding package, " +
        "Beverage package, Service charge, Tax or Other; unit takes per night, per plate, per event " +
        "or percent",
    );
    expect(text).not.toContain("(veg)");
  });

  it("has no list cells, so it states no list rule", () => {
    expect(text).not.toContain("list cell");
    expect(text).toContain("Use the template's column names: an unknown column is refused.");
    expect(text).toContain(`${PREVIEW_TTL_TEXT}.`);
  });
});

describe("a rooms or venues result", () => {
  it("names each row's room or venue after its hotel, in the kind's words", () => {
    expect(changingHeadline(VENUES)).toBe("1 venue to add or update");
    const [lawn] = VENUES.rows;
    expect(rowOutcomeText(lawn!, "venues")).toBe(
      "Line 3 · synthetic-lake-hotel · Synthetic Lawn · Update: setting, capacityBanquet",
    );
    expect(rowOutcomeText({ ...lawn!, outcome: "create" }, "venues")).toContain("New venue");
  });

  it("downloads a report with the hotel's address and the venue's name, refusals included", () => {
    expect(importReportCsv(VENUES).split("\r\n")).toEqual([
      "line,hotelSlug,name,outcome,changedFields,errors",
      '3,synthetic-lake-hotel,Synthetic Lawn,update,"setting, capacityBanquet",',
      "4,synthetic-lake-hotel,Synthetic Hall,error,,row: Changed since preview",
    ]);
  });
});
