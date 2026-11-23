import { describe, expect, it } from "vitest";

import { planImport, type ImportTarget } from "./hotel-import.plan.js";
import {
  COAST,
  importContext as context,
  importRow as row,
  planOne,
  STORED,
  STORED_HOTEL_ID as HOTEL,
} from "./testing/import-plan-fixtures.js";

describe("planImport: an existing hotel", () => {
  it("leaves a row of blank and equal cells unchanged: no status, flag or note moves", () => {
    expect(planOne({ brand: "Synthetic Collection" })).toMatchObject({
      outcome: "unchanged",
      hotelId: HOTEL,
    });
  });

  it("updates only the filled cells that differ, naming them in template order", () => {
    const plan = planOne({ brand: "Synthetic Collection", minNights: 2, status: "inactive" });
    expect(plan).toMatchObject({
      outcome: "update",
      changed: ["status", "minNights"],
      changedFields: ["status", "minNights"],
      movesDestination: false,
    });
  });

  it("compares numbers at the column's scale, lists in order and text trimmed", () => {
    expect(planOne({ latitude: 15.5000001, airportDistanceKm: 12.5 }).outcome).toBe("unchanged");
    expect(planOne({ cuisines: ["goan", "Indian"] })).toMatchObject({ changed: ["cuisines"] });
    expect(planOne({ postalCode: "403 515" }).outcome).toBe("unchanged");
  });

  it("leaves a re-imported seven-decimal coordinate unchanged once the column has rounded it", () => {
    const stored = { ...STORED, values: { ...STORED.values, latitude: 8.186449 } };
    const ctx = context({ hotels: new Map([["synthetic-bay", stored]]) });
    expect(planOne({ latitude: 8.1864485 }, ctx).outcome).toBe("unchanged");
  });

  it("moves the hotel when the destination cell names another one", () => {
    expect(planOne({ destinationSlug: "synthetic-abroad" })).toMatchObject({
      outcome: "update",
      changed: [],
      movesDestination: true,
      changedFields: ["destinationSlug"],
    });
  });

  it("moves a hotel only on its slug, never on a web address made from the name", () => {
    const byName = planImport(
      [{ line: 2, row: { destinationSlug: "synthetic-abroad", name: "Synthetic Bay" } }],
      context(),
    )[0];
    expect(byName).toMatchObject({
      outcome: "error",
      slug: "synthetic-bay",
      errors: [{ field: "slug", message: expect.stringContaining("filed under synthetic-coast") }],
    });
    const sameDestination = planImport(
      [{ line: 2, row: { destinationSlug: "synthetic-coast", name: "Synthetic Bay" } }],
      context(),
    )[0];
    expect(sameDestination).toMatchObject({ outcome: "update", changed: ["name"] });
  });

  it("refuses a change from an uploader who may not update hotels, but not a row that changes nothing", () => {
    const ctx = context({ canUpdate: false });
    expect(planOne({ minNights: 3 }, ctx)).toMatchObject({
      outcome: "error",
      errors: [{ field: "slug" }],
    });
    expect(planOne({ brand: "Synthetic Collection" }, ctx).outcome).toBe("unchanged");
  });
});

describe("planImport: a new hotel", () => {
  it("creates it, naming the filled columns it takes from the file", () => {
    const plan = planOne({
      slug: "synthetic-cove",
      name: "Synthetic Cove",
      city: "Synthetic Town",
    });
    expect(plan).toMatchObject({
      outcome: "create",
      slug: "synthetic-cove",
      changedFields: ["destinationSlug", "name", "city"],
    });
  });

  it("makes the web address from the name when the slug cell is blank", () => {
    const plan = planImport(
      [{ line: 2, row: { destinationSlug: "synthetic-coast", name: "Synthetic Cove Inn" } }],
      context(),
    )[0];
    expect(plan).toMatchObject({ outcome: "create", slug: "synthetic-cove-inn" });
  });
});

describe("planImport: refused rows", () => {
  it("refuses a deleted hotel's web address and a deleted destination", () => {
    const deleted = { ...STORED, deletedAt: new Date("2026-11-20T00:00:00.000Z") };
    const ctx = context({
      hotels: new Map([["synthetic-bay", deleted]]),
      destinations: new Map([["synthetic-coast", { ...COAST, deletedAt: new Date() }]]),
    });
    expect(planOne({}, ctx)).toMatchObject({
      outcome: "error",
      errors: [
        { field: "slug", message: expect.stringMatching(/deleted hotel/) },
        { field: "destinationSlug" },
      ],
    });
  });

  it("refuses a row with no slug cell when the web address made from its name is a deleted hotel's", () => {
    const deleted = { ...STORED, deletedAt: new Date("2026-11-20T00:00:00.000Z") };
    const [plan] = planImport(
      [{ line: 2, row: { destinationSlug: "synthetic-coast", name: "Synthetic Bay" } }],
      context({ hotels: new Map([["synthetic-bay", deleted]]) }),
    );
    expect(plan).toEqual({
      outcome: "error",
      line: 2,
      slug: "synthetic-bay",
      errors: [
        {
          field: "slug",
          message: "A deleted hotel used this web address; give this hotel another one",
        },
      ],
    });
  });

  it("refuses a web address an earlier line already used", () => {
    const plans = planImport(
      [
        { line: 2, row: row({ slug: "synthetic-cove", name: "Synthetic Cove" }) },
        { line: 3, row: row({ slug: "synthetic-cove", name: "Synthetic Cove Again" }) },
      ],
      context(),
    );
    expect(plans.map((plan) => plan.outcome)).toEqual(["create", "error"]);
    expect(plans[1]).toMatchObject({
      errors: [{ message: "Line 2 already uses this web address" }],
    });
  });

  it("refuses a filled internal rating or notes cell without the notes key, even an equal one", () => {
    const ctx = context({ canWriteNotes: false });
    expect(
      planOne({ internalNotes: "Synthetic internal note", internalRating: 4 }, ctx),
    ).toMatchObject({
      outcome: "error",
      errors: [{ field: "internalRating" }, { field: "internalNotes" }],
    });
  });

  it("checks a PIN against the destination's country, a new destination counting as India", () => {
    expect(planOne({ postalCode: "03515" })).toMatchObject({ errors: [{ field: "postalCode" }] });
    expect(planOne({ destinationSlug: "synthetic-abroad", postalCode: "1100-148" }).outcome).toBe(
      "update",
    );
    const fresh = planOne({
      slug: "synthetic-new",
      destinationSlug: "synthetic-new",
      postalCode: "0",
    });
    expect(fresh).toMatchObject({ outcome: "error", errors: [{ field: "postalCode" }] });
  });

  it("checks the PIN a moving hotel keeps when its postal code cell is blank", () => {
    const abroad: ImportTarget = {
      ...STORED,
      filing: { destinationSlug: "synthetic-abroad", postalCode: "1100-148" },
    };
    const ctx = context({ hotels: new Map([["synthetic-bay", abroad]]) });
    expect(planOne({}, ctx)).toMatchObject({
      outcome: "error",
      errors: [{ field: "postalCode", message: expect.stringMatching(/new destination/) }],
    });
    expect(planOne({ postalCode: "403 516" }, ctx)).toMatchObject({
      outcome: "update",
      changedFields: ["destinationSlug", "postalCode"],
    });
    expect(planOne({ destinationSlug: "synthetic-abroad" }).outcome).toBe("update");
  });

  it("refuses an unknown cuisine by index; an option, Other and the hotel's own labels pass", () => {
    expect(planOne({ cuisines: ["Indian", "Martian"] })).toMatchObject({
      errors: [{ field: "cuisines.1" }],
    });
    const plan = planOne({ cuisines: ["indian", "Goan", "other", "Italian"] });
    expect(plan).toMatchObject({
      outcome: "update",
      row: { cuisines: ["Indian", "Goan", "Other", "Italian"] },
    });
  });
});
