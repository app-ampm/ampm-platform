import { hasErrors } from "./hotel-form-fields";
import { rateCardViewFixture, rateItemViewFixture, ROOM_ID } from "./hotels-admin.test-utils";
import {
  buildRateCardBody,
  buildRateItemBody,
  buildVerificationBody,
  draftFromRateCard,
  draftFromRateItem,
  emptyVerificationDraft,
  validateRateCard,
  validateRateItem,
} from "./rate-cards.form";

describe("rate card form", () => {
  it("seeds an edit draft and builds the body (INR, dates or null)", () => {
    const draft = draftFromRateCard(
      rateCardViewFixture({ name: "Peak", validFrom: "2027-01-01", source: "Phone" }),
    );
    expect(draft).toMatchObject({ name: "Peak", validFrom: "2027-01-01", source: "Phone" });
    expect(buildRateCardBody(draft)).toMatchObject({
      name: "Peak",
      validFrom: "2027-01-01",
      currency: "INR",
      source: "Phone",
    });
  });

  it("requires a name and rejects a malformed date", () => {
    const valid = draftFromRateCard(rateCardViewFixture());
    expect(hasErrors(validateRateCard(valid))).toBe(false);
    const errors = validateRateCard({ ...valid, name: " ", validFrom: "01-2027" });
    expect(errors.name).toBeDefined();
    expect(errors.validFrom).toBeDefined();
  });

  it("rejects a validity window that ends before it starts", () => {
    const valid = draftFromRateCard(rateCardViewFixture());
    expect(
      validateRateCard({ ...valid, validFrom: "2027-06-01", validTo: "2027-01-01" }).validTo,
    ).toBeDefined();
    expect(
      validateRateCard({ ...valid, validFrom: "2027-01-01", validTo: "2027-06-01" }).validTo,
    ).toBeUndefined();
  });
});

describe("rate item form", () => {
  it("seeds an edit draft from the item's money (paise -> rupees)", () => {
    expect(draftFromRateItem(rateItemViewFixture())).toMatchObject({
      itemType: "room_rate",
      amount: "16000",
      amountMax: "24000",
      unit: "per_night",
      clientVisible: true,
    });
  });

  it("requires a valid amount and an upper bound at least the amount", () => {
    const valid = draftFromRateItem(rateItemViewFixture());
    expect(hasErrors(validateRateItem(valid))).toBe(false);
    expect(validateRateItem({ ...valid, amount: "" }).amount).toBeDefined();
    expect(validateRateItem({ ...valid, amount: "nope" }).amount).toBeDefined();
    expect(
      validateRateItem({ ...valid, amount: "20000", amountMax: "10000" }).amountMax,
    ).toBeDefined();
  });

  it("builds the body with wire paise and nulls the blanks", () => {
    const body = buildRateItemBody({
      itemType: "per_plate_veg",
      amount: "2,500",
      amountMax: "",
      unit: "per_plate",
      isIndicative: true,
      minQuantity: "100",
      inclusionsText: " ",
      clientVisible: true,
      roomCategoryId: null,
      venueId: null,
    });
    expect(body).toEqual({
      itemType: "per_plate_veg",
      roomCategoryId: null,
      venueId: null,
      amount: { minor: 250000, currency: "INR" },
      amountMax: null,
      isIndicative: true,
      unit: "per_plate",
      minQuantity: 100,
      inclusionsText: null,
      clientVisible: true,
    });
  });

  it("preserves an existing room/venue link through an edit (never clears it)", () => {
    const linked = rateItemViewFixture({ roomCategoryId: ROOM_ID, venueId: null });
    const body = buildRateItemBody(draftFromRateItem(linked));
    expect(body).toMatchObject({ roomCategoryId: ROOM_ID, venueId: null });
  });

  it("returns null when the amount does not parse", () => {
    expect(buildRateItemBody({ ...draftFromRateItem(null), amount: "oops" })).toBeNull();
  });
});

describe("verification form", () => {
  it("builds a rates verification body, trimming the note", () => {
    expect(buildVerificationBody({ source: "site_visit", notes: " on site " })).toEqual({
      fieldGroup: "rates",
      source: "site_visit",
      notes: "on site",
    });
    expect(buildVerificationBody(emptyVerificationDraft())).toEqual({
      fieldGroup: "rates",
      source: "phone",
      notes: null,
    });
  });
});
