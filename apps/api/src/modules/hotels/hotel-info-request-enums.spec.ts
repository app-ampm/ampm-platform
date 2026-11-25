import {
  hotelInfoRequestActorKind,
  hotelInfoRequestEventType,
  hotelInfoRequestKind,
  hotelInfoRequestPrefillMode,
  hotelInfoRequestStatus,
  hotelInfoRequestTarget,
  recipientType,
} from "@ampm/core";
import { STATUS_MACHINES } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import {
  HotelInfoRequestActorKind,
  HotelInfoRequestEventType,
  HotelInfoRequestKind,
  HotelInfoRequestPrefillMode,
  HotelInfoRequestStatus,
  HotelInfoRequestTarget,
  RecipientType,
} from "../../generated/prisma/enums.js";

/*
 * The hotel information request enums (D-188 §1) and the notification recipient types (§5) are written
 * three times: the database enums (schema.prisma), the core contracts and the policy's status machine.
 * A value added to one alone would be refused by another at run time, so they must stay equal.
 */
describe("hotel information request enums, kept in step", () => {
  it("are the same in the database and in core", () => {
    expect(Object.values(HotelInfoRequestKind)).toEqual(hotelInfoRequestKind.options);
    expect(Object.values(HotelInfoRequestTarget)).toEqual(hotelInfoRequestTarget.options);
    expect(Object.values(HotelInfoRequestStatus)).toEqual(hotelInfoRequestStatus.options);
    expect(Object.values(HotelInfoRequestPrefillMode)).toEqual(hotelInfoRequestPrefillMode.options);
    expect(Object.values(HotelInfoRequestEventType)).toEqual(hotelInfoRequestEventType.options);
    expect(Object.values(HotelInfoRequestActorKind)).toEqual(hotelInfoRequestActorKind.options);
    expect(Object.values(RecipientType)).toEqual(recipientType.options);
  });

  it("give the policy's status machine exactly the database's statuses", () => {
    expect(STATUS_MACHINES["hotel_info_request"]?.statuses).toEqual(
      Object.values(HotelInfoRequestStatus),
    );
  });
});
