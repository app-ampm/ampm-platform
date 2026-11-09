import {
  configArea,
  configFields,
  configLabel,
  configRowSummary,
  configSummary,
  formatConfigScalar,
  prettifyIdentifier,
  toConfigEntries,
} from "./configuration.format";

describe("configuration.format", () => {
  it("prettifies dotted and camelCase identifiers", () => {
    expect(prettifyIdentifier("staffMinutes")).toBe("Staff minutes");
    expect(prettifyIdentifier("hotel.verification_policy")).toBe("Hotel verification policy");
    expect(prettifyIdentifier("")).toBe("");
  });

  it("labels and areas known keys, and falls back for an unknown key", () => {
    expect(configLabel("session.idle_timeouts")).toBe("Session idle timeouts");
    expect(configArea("consultancy.chargeable_services")).toBe("Consultancy");
    // An unrecognised key still renders (the key becomes the label; area is "Other").
    expect(configLabel("brand.new_key")).toBe("Brand new key");
    expect(configArea("brand.new_key")).toBe("Other");
  });

  it("renders a scalar value by type", () => {
    expect(formatConfigScalar(true)).toBe("On");
    expect(formatConfigScalar(false)).toBe("Off");
    expect(formatConfigScalar(90)).toBe("90");
    expect(formatConfigScalar("negotiation")).toBe("negotiation");
    expect(formatConfigScalar(["a", "b"])).toBe("a, b");
    expect(formatConfigScalar([])).toBe("—");
    expect(formatConfigScalar("")).toBe("—");
  });

  it("flattens an object value into one field per key", () => {
    expect(configFields({ staffMinutes: 720, clientMinutes: 43200 })).toEqual([
      { label: "Staff minutes", value: "720" },
      { label: "Client minutes", value: "43200" },
    ]);
  });

  it("returns no fields for an empty object and a single Value row for a primitive", () => {
    expect(configFields({})).toEqual([]);
    expect(configFields(42)).toEqual([{ label: "Value", value: "42" }]);
  });

  it("summarises a value on one line, and says when nothing is set", () => {
    expect(configSummary({ maxAgeDays: 90 })).toBe("Max age days: 90");
    expect(configSummary({ milestoneAmountsVisible: false })).toBe(
      "Milestone amounts visible: Off",
    );
    expect(configSummary({})).toBe("Not set");
  });

  it("joins an array field into its summary", () => {
    expect(configSummary({ chargeableServiceKeys: ["negotiation", "site_visit"] })).toBe(
      "Chargeable service keys: negotiation, site_visit",
    );
  });

  it("drops the own-screen key and sorts the rest by area then label", () => {
    const entries = toConfigEntries([
      { key: "notification.templates", value: {} },
      { key: "hotel.verification_policy", value: { maxAgeDays: 90 } },
      { key: "feature.flags", value: {} },
      { key: "session.idle_timeouts", value: { staffMinutes: 720 } },
    ]);
    // notification.templates is filtered out; Access < Hotels < Platform by area.
    expect(entries.map((entry) => entry.key)).toEqual([
      "session.idle_timeouts",
      "hotel.verification_policy",
      "feature.flags",
    ]);
  });

  it("orders two settings in the same area by their label (within-area tiebreaker)", () => {
    // Both keys are in the Consultancy area, so the area comparison ties and the label decides.
    // Fed in reverse of the expected order, so a no-op or stable secondary sort would fail here.
    const entries = toConfigEntries([
      { key: "consultancy.milestone_amounts_visible", value: { milestoneAmountsVisible: false } },
      { key: "consultancy.chargeable_services", value: { chargeableServiceKeys: [] } },
    ]);
    expect(entries.map((entry) => entry.key)).toEqual([
      "consultancy.chargeable_services", // "Chargeable consultancy services"
      "consultancy.milestone_amounts_visible", // "Client sees milestone amounts"
    ]);
  });

  it("summarises a row for the screen reader", () => {
    expect(configRowSummary({ key: "hotel.verification_policy", value: { maxAgeDays: 90 } })).toBe(
      "Hotel verification policy, Hotels. Max age days: 90",
    );
  });
});
