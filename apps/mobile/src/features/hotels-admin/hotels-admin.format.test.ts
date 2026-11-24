import { TRI_STATES } from "./hotel-form-fields";
import {
  BUYOUT_CHOICES,
  buyoutChoiceLabel,
  hotelRowSummary,
  latestVerification,
  hotelStatusLabel,
  PARALLEL_CHOICES,
  parallelChoiceLabel,
  hotelStatusTone,
  rateCardStatusLabel,
  rateCardStatusTone,
  rateItemTypeLabel,
  rateUnitLabel,
  triStateLabel,
  verificationSourceLabel,
  yesNo,
} from "./hotels-admin.format";
import { hotelStaffViewFixture, verificationViewFixture } from "./hotels-admin.test-utils";

describe("hotels-admin.format", () => {
  it("labels and tones the hotel status", () => {
    expect(hotelStatusLabel("draft")).toBe("Draft");
    expect(hotelStatusLabel("active")).toBe("Active");
    expect(hotelStatusTone("active")).toBe("success");
    expect(hotelStatusTone("inactive")).toBe("warning");
  });

  it("summarises a hotel row for screen readers", () => {
    expect(
      hotelRowSummary(hotelStaffViewFixture({ name: "Synthetic Lake Hotel", status: "active" })),
    ).toBe("Synthetic Lake Hotel, active");
  });

  it("labels the profile's yes / no answers and booking terms, Not known and Not set first", () => {
    expect(TRI_STATES.map(triStateLabel)).toEqual(["Not known", "Yes", "No"]);
    expect(BUYOUT_CHOICES.map(buyoutChoiceLabel)).toEqual([
      "Not set",
      "Not required",
      "Required",
      "Depends",
    ]);
    expect(PARALLEL_CHOICES.map(parallelChoiceLabel)).toEqual([
      "Not set",
      "Allowed",
      "Not allowed",
      "Depends",
    ]);
  });

  it("labels and tones rate cards, items, units and verification sources", () => {
    expect(rateCardStatusLabel("verified")).toBe("Verified");
    expect(rateCardStatusTone("stale")).toBe("warning");
    expect(rateCardStatusTone("verified")).toBe("success");
    expect(rateItemTypeLabel("per_plate_veg")).toBe("Per plate (veg)");
    expect(rateUnitLabel("per_night")).toBe("per night");
    expect(verificationSourceLabel("site_visit")).toBe("Site visit");
  });

  it("reads a flag as a word", () => {
    expect(yesNo(true)).toBe("Yes");
    expect(yesNo(false)).toBe("No");
  });

  describe("latestVerification", () => {
    const at = (n: number, verifiedAt: string | null, fieldGroup: "rates" | "rooms" = "rates") =>
      verificationViewFixture({
        id: `018f0000-0000-7000-8000-0000000c120${n}`,
        verifiedAt,
        fieldGroup,
      });

    it("picks the newest dated record of the group, whatever the list's order", () => {
      const list = [
        at(1, null),
        at(2, "2026-10-01T09:00:00Z"),
        at(3, "2026-11-20T09:00:00Z", "rooms"),
        at(4, "2026-11-02T06:30:00Z"),
      ];
      expect(latestVerification(list, "rates")?.id).toBe("018f0000-0000-7000-8000-0000000c1204");
    });

    it("has none when the group was never verified on a day", () => {
      expect(
        latestVerification([at(1, null), at(2, "2026-10-01T09:00:00Z", "rooms")], "rates"),
      ).toBe(undefined);
    });
  });
});
