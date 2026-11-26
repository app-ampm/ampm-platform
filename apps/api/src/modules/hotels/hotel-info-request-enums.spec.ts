import {
  auditActorType,
  hotelFormCodeDelivery,
  hotelFormSectionKey,
  hotelInfoRequestActorKind,
  hotelInfoRequestConsentKind,
  hotelInfoRequestEventType,
  hotelInfoRequestKind,
  hotelInfoRequestPrefillMode,
  hotelInfoRequestStatus,
  hotelInfoRequestTarget,
  hotelInfoRequestWithdrawalSource,
  recipientType,
} from "@ampm/core";
import { STATUS_MACHINES } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import {
  ActorType,
  HotelFormCodeDelivery,
  HotelFormSectionKey,
  HotelInfoRequestActorKind,
  HotelInfoRequestConsentKind,
  HotelInfoRequestEventType,
  HotelInfoRequestKind,
  HotelInfoRequestPrefillMode,
  HotelInfoRequestStatus,
  HotelInfoRequestTarget,
  HotelInfoRequestWithdrawalSource,
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

  it("keep the identity step's enums (D-189 §1) and the audit's actor types the same in both", () => {
    expect(Object.values(HotelFormCodeDelivery)).toEqual(hotelFormCodeDelivery.options);
    expect(Object.values(HotelInfoRequestConsentKind)).toEqual(hotelInfoRequestConsentKind.options);
    expect(Object.values(HotelInfoRequestWithdrawalSource)).toEqual(
      hotelInfoRequestWithdrawalSource.options,
    );
    expect(Object.values(ActorType)).toEqual(auditActorType.options);
  });

  it("keep the form's section keys (D-190 §1) the same in both", () => {
    expect(Object.values(HotelFormSectionKey)).toEqual(hotelFormSectionKey.options);
  });

  it("give the policy's status machine exactly the database's statuses", () => {
    expect(STATUS_MACHINES["hotel_info_request"]?.statuses).toEqual(
      Object.values(HotelInfoRequestStatus),
    );
  });
});
