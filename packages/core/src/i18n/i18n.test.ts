import { describe, expect, it } from "vitest";

import { createI18n } from "./index";

describe("i18n", () => {
  it("translates the shared error keys in English", () => {
    const i18n = createI18n("en");
    expect(i18n.t("errors.not_found")).toBe("We could not find that.");
    expect(i18n.t("common.retry")).toBe("Try again");
  });
});
