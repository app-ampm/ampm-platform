import { buildReferenceBody, draftFromReference, validateReference } from "./references.form";
import { weddingReferenceFixture } from "./hotels-admin.test-utils";

const draft = (overrides: Partial<ReturnType<typeof draftFromReference>> = {}) => ({
  ...draftFromReference(null),
  eventYear: "2024",
  ...overrides,
});

describe("references.form", () => {
  it("starts blank for a new reference and from the stored values for an edit", () => {
    expect(draftFromReference(null)).toEqual({
      eventYear: "",
      guestCount: "",
      descriptionClient: "",
    });
    expect(draftFromReference(weddingReferenceFixture())).toEqual({
      eventYear: "2024",
      guestCount: "320",
      descriptionClient: "A three-day lakeside celebration",
    });
  });

  it("requires a four-digit year within the field matrix's range", () => {
    expect(validateReference(draft({ eventYear: "" })).eventYear).toBe(
      "Enter the year of the wedding",
    );
    expect(validateReference(draft({ eventYear: "24" })).eventYear).toBe(
      "Enter a four-digit year, e.g. 2024",
    );
    expect(validateReference(draft({ eventYear: "1899" })).eventYear).toBeDefined();
    expect(validateReference(draft()).eventYear).toBeUndefined();
  });

  it("takes a blank or whole-number guest count and caps the description", () => {
    expect(validateReference(draft({ guestCount: "" })).guestCount).toBeUndefined();
    expect(validateReference(draft({ guestCount: "3.5" })).guestCount).toBe(
      "Guests must be a whole number",
    );
    expect(
      validateReference(draft({ descriptionClient: "x".repeat(10_001) })).descriptionClient,
    ).toBeDefined();
  });

  it("builds the request with blanks as null, never a consent id", () => {
    expect(buildReferenceBody(draft({ guestCount: " 150 ", descriptionClient: "  " }))).toEqual({
      eventYear: 2024,
      guestCount: 150,
      descriptionClient: null,
    });
  });
});
