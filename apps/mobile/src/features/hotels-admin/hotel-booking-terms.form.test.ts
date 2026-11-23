import {
  bookingTermsBody,
  bookingTermsDraftFrom,
  validateBookingTerms,
} from "./hotel-booking-terms.form";
import { hotelStaffViewFixture } from "./hotels-admin.test-utils";

describe("hotel-booking-terms.form", () => {
  it("starts with nothing set, and seeds the hotel's terms", () => {
    expect(bookingTermsDraftFrom(null)).toEqual({
      weddingBuyoutPolicy: "unset",
      minRoomsWithoutBuyout: "",
      minNights: "",
      parallelFunctions: "unset",
      bookingNotes: "",
    });
    const hotel = hotelStaffViewFixture({
      weddingBuyoutPolicy: "required",
      minRoomsWithoutBuyout: 40,
      minNights: 2,
      parallelFunctions: "allowed",
      bookingNotes: "Synthetic terms",
    });
    expect(bookingTermsDraftFrom(hotel)).toEqual({
      weddingBuyoutPolicy: "required",
      minRoomsWithoutBuyout: "40",
      minNights: "2",
      parallelFunctions: "allowed",
      bookingNotes: "Synthetic terms",
    });
  });

  it("checks the minimums against the contract's bounds", () => {
    const draft = bookingTermsDraftFrom(null);
    expect(
      validateBookingTerms({ ...draft, minRoomsWithoutBuyout: "10001", minNights: "0" }),
    ).toEqual({
      minRoomsWithoutBuyout: "Minimum rooms is a whole number, from 0 to 10,000",
      minNights: "Minimum nights is a whole number, from 1 to 60",
    });
    expect(validateBookingTerms({ ...draft, minRoomsWithoutBuyout: "0", minNights: "60" })).toEqual(
      {
        minRoomsWithoutBuyout: undefined,
        minNights: undefined,
      },
    );
    expect(validateBookingTerms({ ...draft, minNights: "1.5" }).minNights).toBeDefined();
  });

  it("sends not set and blanks as null, and the rest as typed", () => {
    expect(bookingTermsBody(bookingTermsDraftFrom(null))).toEqual({
      weddingBuyoutPolicy: null,
      minRoomsWithoutBuyout: null,
      minNights: null,
      parallelFunctions: null,
      bookingNotes: null,
    });
    expect(
      bookingTermsBody({
        weddingBuyoutPolicy: "depends",
        minRoomsWithoutBuyout: " 25 ",
        minNights: "3",
        parallelFunctions: "not_allowed",
        bookingNotes: "  Synthetic terms ",
      }),
    ).toEqual({
      weddingBuyoutPolicy: "depends",
      minRoomsWithoutBuyout: 25,
      minNights: 3,
      parallelFunctions: "not_allowed",
      bookingNotes: "Synthetic terms",
    });
  });
});
