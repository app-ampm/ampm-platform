import {
  blockedSaveToast,
  errorsOnShow,
  firstInvalidField,
  placeServerErrors,
  PROFILE_FIELD_ORDER,
  profileFieldLabel,
  SERVER_CHECKED_FIELDS,
  withoutEdited,
} from "./hotel-profile.errors";
import { draftFromHotel, validateDraft } from "./hotel-profile.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

const valid = draftFromHotel(hotelStaffViewFixture());
const PIN_REFUSED = "A PIN code is 6 digits and does not start with 0";
const CUISINE_REFUSED = "Choose a cuisine from the list, or Other";

describe("hotel-profile.errors", () => {
  it("orders every checked field once, so none can be skipped when a save is blocked or refused", () => {
    const keys = [...Object.keys(validateDraft(valid)), ...SERVER_CHECKED_FIELDS].sort();
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

describe("a save the server refuses", () => {
  it("puts each error under the field the first part of its path names, keeping its first message", () => {
    const placed = placeServerErrors([
      { path: "cuisines.2", message: CUISINE_REFUSED },
      { path: "cuisines.4", message: "A later refusal of the same field" },
      { path: "postalCode", message: PIN_REFUSED },
      { path: "internalNotes", message: "At most 10,000 characters" },
    ]);
    expect(placed).toEqual({
      cuisines: CUISINE_REFUSED,
      postalCode: PIN_REFUSED,
      internalNotes: "At most 10,000 characters",
    });
    expect(firstInvalidField(placed)).toBe("postalCode");
  });

  it("leaves out an error with no path, or a path the editor has no field for", () => {
    expect(placeServerErrors([{ message: "Validation failed" }])).toEqual({});
    const mixed = placeServerErrors([
      { path: "slug", message: "Synthetic slug refusal" },
      { path: "website", message: "Invalid URL" },
    ]);
    expect(mixed).toEqual({ website: "Invalid URL" });
  });

  it("shows a field's failing check over the server's word, and the server's while the check passes", () => {
    const server = { postalCode: PIN_REFUSED, cuisines: CUISINE_REFUSED };
    expect(errorsOnShow({ postalCode: "Checked here" }, server)).toEqual({
      postalCode: "Checked here",
      cuisines: CUISINE_REFUSED,
    });
    expect(errorsOnShow(validateDraft(valid), server)).toEqual(server);
    expect(errorsOnShow(validateDraft(valid), {})).toEqual({});
  });

  it("drops the server's word on a field once it is edited, keeping the rest", () => {
    const server = { postalCode: PIN_REFUSED, cuisines: CUISINE_REFUSED };
    expect(withoutEdited(server, ["postalCode", "city"])).toEqual({ cuisines: CUISINE_REFUSED });
    expect(withoutEdited(server, ["brand"])).toEqual(server);
  });
});
