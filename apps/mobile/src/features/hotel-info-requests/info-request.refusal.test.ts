import { AppError } from "@ampm/core";

import { REQUEST_FIELDS } from "./info-request.form";
import { refusalOf } from "./info-request.refusal";

describe("refusalOf", () => {
  it("keeps the API's message, and places a detail under the field it names", () => {
    const error = new AppError("validation_failed", "Check the recipient's email", [
      { path: "recipientEmail", message: "Enter a valid email" },
      { path: "unknownField", message: "Ignored" },
    ]);
    expect(refusalOf(error, "Could not create the request")).toEqual({
      message: "Check the recipient's email",
      fields: { recipientEmail: "Enter a valid email" },
    });
  });

  it("keeps a conflict's message, which names the live request", () => {
    const error = new AppError("conflict", "This hotel already has a live request: HIR-2026-0001");
    expect(refusalOf(error, "x")).toEqual({
      message: "This hotel already has a live request: HIR-2026-0001",
      fields: {},
    });
  });

  it("places a detail under every field of the sheets' one field list, and none under the switches", () => {
    const details = [...REQUEST_FIELDS, "kind", "emailIt", "isTest"].map((path) => ({
      path,
      message: `Check ${path}`,
    }));
    const { fields } = refusalOf(new AppError("validation_failed", "Check", details), "x");
    expect(Object.keys(fields).sort()).toEqual([...REQUEST_FIELDS].sort());
  });

  it("falls back to the sheet's words for anything that is not the API's", () => {
    expect(refusalOf(new Error("boom"), "Could not create the request")).toEqual({
      message: "Could not create the request",
      fields: {},
    });
  });
});
