import { errors } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { hotelFormQueryClient } from "./hotel-form-provider";

/* The hotel form's own query client (D-190 §5): its pages count a 429's Retry-After down themselves. */

describe("hotelFormQueryClient", () => {
  it("never tries a query refused with 429 again, and still tries a lost connection", () => {
    const retry = hotelFormQueryClient().getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") throw new Error("The client decides each retry itself");
    expect(retry(0, errors.rateLimited("Too many requests", 30))).toBe(false);
    expect(retry(0, errors.internal())).toBe(true);
  });
});
