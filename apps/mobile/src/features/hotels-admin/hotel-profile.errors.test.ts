import {
  blockedSaveToast,
  firstInvalidField,
  PROFILE_FIELD_ORDER,
  profileFieldLabel,
} from "./hotel-profile.errors";
import { draftFromHotel, validateDraft } from "./hotel-profile.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

const valid = draftFromHotel(hotelStaffViewFixture());

describe("hotel-profile.errors", () => {
  it("orders every checked field once, so none can be skipped when a save is blocked", () => {
    const keys = Object.keys(validateDraft(valid)).sort();
    expect([...PROFILE_FIELD_ORDER].sort()).toEqual(keys);
    expect(new Set(PROFILE_FIELD_ORDER).size).toBe(PROFILE_FIELD_ORDER.length);
  });

  it("finds the highest field with an error, or none", () => {
    expect(firstInvalidField(validateDraft(valid))).toBeUndefined();
    const lower = validateDraft({ ...valid, minNights: "0", mapsUrl: "https://example.com" });
    expect(firstInvalidField(lower)).toBe("mapsUrl");
    const top = validateDraft({ ...valid, name: "", minNights: "0" });
    expect(firstInvalidField(top)).toBe("name");
  });

  it("names the first field to fix and why, in a danger toast", () => {
    expect(profileFieldLabel("minNights")).toBe("Minimum nights");
    expect(blockedSaveToast("minNights", "Minimum nights is a whole number, from 1 to 60")).toEqual(
      {
        title: "Check the highlighted fields",
        description: "Minimum nights: Minimum nights is a whole number, from 1 to 60",
        tone: "danger",
      },
    );
  });
});
