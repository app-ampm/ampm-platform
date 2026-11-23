import { describe, expect, it } from "vitest";

import {
  CREATE_ONLY,
  importContext as context,
  planOne,
  STORED,
} from "./testing/import-plan-fixtures.js";

/*
 * The import's rows are held to the uploader's own keys beyond the create key the route asks for (D-181,
 * D-164): changing an existing hotel, creating a destination, adding an image; and a dry run compares a
 * cell only with a stored value the uploader may read. The Hotel team and the Super Admin hold them all,
 * so these matter for custom roles.
 */

const COVE = { slug: "synthetic-cove", name: "Synthetic Cove" };

describe("planImport: a create-only uploader", () => {
  it("adds a hotel at a destination that exists, and leaves an unchanged row alone", () => {
    expect(planOne(COVE, context(CREATE_ONLY)).outcome).toBe("create");
    expect(planOne({ brand: "Synthetic Collection" }, context(CREATE_ONLY)).outcome).toBe(
      "unchanged",
    );
  });

  it("refuses a row that would change an existing hotel", () => {
    expect(planOne({ minNights: 3 }, context(CREATE_ONLY))).toMatchObject({
      outcome: "error",
      errors: [{ field: "slug", message: expect.stringMatching(/cannot change existing hotels/) }],
    });
  });
});

describe("planImport: destinations", () => {
  const refused = {
    field: "destinationSlug",
    message: expect.stringMatching(/cannot create destinations/),
  };

  it("refuses a new destination without the destinations key, for a new hotel and for a move", () => {
    expect(
      planOne({ ...COVE, destinationSlug: "synthetic-new" }, context(CREATE_ONLY)),
    ).toMatchObject({ outcome: "error", errors: [refused] });
    const move = context({ canCreateDestinations: false });
    expect(planOne({ destinationSlug: "synthetic-new" }, move)).toMatchObject({
      outcome: "error",
      errors: [refused],
    });
  });

  it("creates the destination with the key, and needs none for one that exists", () => {
    expect(planOne({ ...COVE, destinationSlug: "synthetic-new" }).outcome).toBe("create");
    const move = context({ canCreateDestinations: false });
    expect(planOne({ destinationSlug: "synthetic-abroad" }, move).outcome).toBe("update");
  });
});

describe("planImport: images", () => {
  const imageRef = "https://img.example/synthetic-cove.jpg";

  it("refuses a filled imageRef without the media key, on a new hotel and an existing one", () => {
    const ctx = context({ canAddMedia: false });
    for (const cells of [{ ...COVE, imageRef }, { imageRef }]) {
      expect(planOne(cells, ctx)).toMatchObject({
        outcome: "error",
        errors: [{ field: "imageRef", message: "You cannot add hotel images" }],
      });
    }
  });

  it("adds an image to an unchanged hotel only for an uploader who may change the hotel", () => {
    const cells = { brand: "Synthetic Collection", imageRef };
    expect(planOne(cells)).toMatchObject({ outcome: "unchanged", row: cells });
    expect(planOne(cells, context({ canUpdate: false }))).toMatchObject({
      outcome: "error",
      errors: [{ field: "imageRef", message: expect.stringMatching(/existing hotels/) }],
    });
  });
});

describe("planImport: values the uploader cannot read", () => {
  const unread = new Map([["synthetic-bay", { ...STORED, values: {} }]]);

  it("counts every filled cell as a change, so the outcome never tells a guess from a match", () => {
    expect(planOne({ brand: "Synthetic Collection" }, context({ hotels: unread }))).toMatchObject({
      outcome: "update",
      changed: ["name", "brand"],
    });
    expect(
      planOne({ brand: "Synthetic Collection" }, context({ ...CREATE_ONLY, hotels: unread })),
    ).toMatchObject({
      outcome: "error",
      errors: [{ field: "slug" }],
    });
  });

  it("still checks the PIN a moving hotel keeps, though its profile is unread", () => {
    const abroad = {
      ...STORED,
      values: {},
      destinationSlug: "synthetic-abroad",
      postalCode: "1100-148",
    };
    const ctx = context({ hotels: new Map([["synthetic-bay", abroad]]) });
    expect(planOne({}, ctx)).toMatchObject({ outcome: "error", errors: [{ field: "postalCode" }] });
  });
});
