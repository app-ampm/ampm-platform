import {
  configDraftFromValue,
  configEditFields,
  configOptionLabel,
  isEditableConfigKey,
  validateConfigDraft,
} from "./configuration.edit";

describe("configuration.edit", () => {
  describe("isEditableConfigKey", () => {
    it("is true for a key with an editor, false for templates and for an unknown key", () => {
      expect(isEditableConfigKey("session.idle_timeouts")).toBe(true);
      expect(isEditableConfigKey("feature.flags")).toBe(true);
      // Notification templates have their own screen; an unrecognised key has no editor.
      expect(isEditableConfigKey("notification.templates")).toBe(false);
      expect(isEditableConfigKey("brand.new_key")).toBe(false);
    });
  });

  it("lists an enum field's options and labels them readably", () => {
    const [field] = configEditFields("consultancy.chargeable_services");
    expect(field?.kind).toBe("enumSet");
    expect(field?.options).toContain("site_visit");
    expect(configOptionLabel("site_visit")).toBe("Site visit");
  });

  describe("configDraftFromValue", () => {
    it("turns numbers into text inputs", () => {
      const draft = configDraftFromValue("session.idle_timeouts", {
        staffMinutes: 720,
        clientMinutes: 43200,
        demoMinutes: 43200,
      });
      expect(draft).toEqual({ staffMinutes: "720", clientMinutes: "43200", demoMinutes: "43200" });
    });

    it("turns a flag record into ordered name/enabled rows", () => {
      const draft = configDraftFromValue("feature.flags", { beta: true, legacy: false });
      expect(draft.flags).toEqual([
        { name: "beta", enabled: true },
        { name: "legacy", enabled: false },
      ]);
    });

    it("keeps a chosen enum set as its array", () => {
      const draft = configDraftFromValue("consultancy.chargeable_services", {
        chargeableServiceKeys: ["negotiation", "site_visit"],
      });
      expect(draft.chargeableServiceKeys).toEqual(["negotiation", "site_visit"]);
    });
  });

  describe("validateConfigDraft", () => {
    it("assembles a valid integer value and reports no errors", () => {
      const result = validateConfigDraft("session.idle_timeouts", {
        staffMinutes: "600",
        clientMinutes: "43200",
        demoMinutes: "43200",
      });
      expect(result.value).toEqual({
        staffMinutes: 600,
        clientMinutes: 43200,
        demoMinutes: 43200,
      });
      expect(result.fieldErrors).toEqual({});
    });

    it("rejects a non-numeric field with a message and no value", () => {
      const result = validateConfigDraft("hotel.verification_policy", { maxAgeDays: "soon" });
      expect(result.value).toBeUndefined();
      expect(result.fieldErrors.maxAgeDays).toBe("Enter a whole number");
    });

    it("enforces each field's own bound: positive for max-age, non-negative for the notice window", () => {
      const zeroMaxAge = validateConfigDraft("hotel.verification_policy", { maxAgeDays: "0" });
      expect(zeroMaxAge.value).toBeUndefined();
      expect(zeroMaxAge.fieldErrors.maxAgeDays).toBe("Must be at least 1");
      // The notice window is `.nonnegative()`, so zero is allowed.
      expect(validateConfigDraft("subscription.policy", { expiryNoticeDays: "0" }).value).toEqual({
        expiryNoticeDays: 0,
      });
      expect(
        validateConfigDraft("subscription.policy", { expiryNoticeDays: "-3" }).fieldErrors
          .expiryNoticeDays,
      ).toBe("Cannot be negative");
    });

    it("assembles booleans and an enum set", () => {
      expect(
        validateConfigDraft("notification.default_channels", {
          inApp: true,
          email: false,
          sms: false,
          whatsapp: true,
          push: false,
        }).value,
      ).toEqual({ inApp: true, email: false, sms: false, whatsapp: true, push: false });
      expect(
        validateConfigDraft("consultancy.chargeable_services", {
          chargeableServiceKeys: ["negotiation"],
        }).value,
      ).toEqual({ chargeableServiceKeys: ["negotiation"] });
    });

    it("assembles a flag map and rejects blank or duplicate flag names", () => {
      expect(
        validateConfigDraft("feature.flags", {
          flags: [
            { name: "beta", enabled: true },
            { name: "legacy", enabled: false },
          ],
        }).value,
      ).toEqual({ beta: true, legacy: false });

      const blank = validateConfigDraft("feature.flags", {
        flags: [{ name: "  ", enabled: true }],
      });
      expect(blank.value).toBeUndefined();
      expect(blank.formError).toBe("Give every flag a name");

      const duplicate = validateConfigDraft("feature.flags", {
        flags: [
          { name: "beta", enabled: true },
          { name: "beta", enabled: false },
        ],
      });
      expect(duplicate.value).toBeUndefined();
      expect(duplicate.formError).toBe("Flag names must be unique");
    });

    it("round-trips a value through the draft and back", () => {
      const original = { staffMinutes: 120, clientMinutes: 240, demoMinutes: 360 };
      const draft = configDraftFromValue("session.idle_timeouts", original);
      expect(validateConfigDraft("session.idle_timeouts", draft).value).toEqual(original);
    });

    it("rejects an editor-shaped value the key's schema refuses (the drift backstop)", () => {
      // The chip UI only offers valid options, but the enum assembly copies the draft as-is, so a key
      // the schema does not know reaches the final `schema.safeParse` guard and is refused there.
      const result = validateConfigDraft("consultancy.chargeable_services", {
        chargeableServiceKeys: ["not_a_real_service"],
      });
      expect(result.value).toBeUndefined();
      expect(result.formError).toBe("That value isn't valid for this setting");
    });
  });
});
