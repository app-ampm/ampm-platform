import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { RATE_LIMIT, type RateLimitOptions } from "../../common/rate-limit/rate-limit.decorator.js";
import { HOTEL_DUPLICATE_HINTS, HOTEL_FORM_LINKS } from "../../common/rate-limit/route-limits.js";
import { HotelInfoRequestsController } from "./hotel-info-requests.controller.js";

/*
 * The rate limits of the hotel information requests' staff routes (D-188 §3 and §5): issuing a link is
 * limited and fails closed; the duplicate hints, asked as staff type and each reading the catalogue, carry
 * a light limit per member of staff that fails open, as a read does.
 */
describe("HotelInfoRequestsController rate limits", () => {
  const reflector = new Reflector();
  const limitOf = (handler: "duplicateHints" | "create" | "reissue") =>
    reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT,
      HotelInfoRequestsController.prototype[handler],
    );

  it("limits the duplicate hints per member of staff, lightly, failing open", () => {
    expect(limitOf("duplicateHints")).toEqual(HOTEL_DUPLICATE_HINTS);
    expect(HOTEL_DUPLICATE_HINTS).toEqual({
      name: "hotel_form.hints",
      limit: 60,
      perIpLimit: 180,
      windowMs: 60_000,
      failClosed: false,
    });
  });

  it("keeps the links' own limit on create and reissue", () => {
    expect(limitOf("create")).toEqual(HOTEL_FORM_LINKS);
    expect(limitOf("reissue")).toEqual(HOTEL_FORM_LINKS);
  });
});
