import type {
  HotelCreateRequest,
  HotelParallelFunctions,
  HotelStaffListItem,
  HotelWeddingBuyoutPolicy,
} from "@ampm/core";

import { numberOrNull, numberRuleError, numberToText, textOrNull } from "./hotel-form-fields";

/*
 * The profile editor's booking terms part (D-178, decision 12): whether a wedding needs the whole hotel,
 * the fewest rooms and nights the hotel takes, whether several functions may run at once, and notes.
 * INTERNAL: every staff profile reader gets them and no client view carries them. A choice the hotel has
 * not given is "unset" in the draft and null in the body, never a guessed answer.
 */

/** A buyout policy, or "unset" while the hotel has not said. */
export type BuyoutChoice = HotelWeddingBuyoutPolicy | "unset";

/** A parallel-functions answer, or "unset" while the hotel has not said. */
export type ParallelChoice = HotelParallelFunctions | "unset";

export interface BookingTermsDraft {
  readonly weddingBuyoutPolicy: BuyoutChoice;
  readonly minRoomsWithoutBuyout: string;
  readonly minNights: string;
  readonly parallelFunctions: ParallelChoice;
  readonly bookingNotes: string;
}

/** Edit seeds from the hotel; create starts with nothing set. */
export function bookingTermsDraftFrom(hotel: HotelStaffListItem | null): BookingTermsDraft {
  return {
    weddingBuyoutPolicy: hotel?.weddingBuyoutPolicy ?? "unset",
    minRoomsWithoutBuyout: numberToText(hotel?.minRoomsWithoutBuyout ?? null),
    minNights: numberToText(hotel?.minNights ?? null),
    parallelFunctions: hotel?.parallelFunctions ?? "unset",
    bookingNotes: hotel?.bookingNotes ?? "",
  };
}

export type BookingTermsErrors = {
  readonly minRoomsWithoutBuyout: string | undefined;
  readonly minNights: string | undefined;
};

/** The contract's bounds: up to 10,000 rooms, and 1 to 60 nights. */
export function validateBookingTerms(draft: BookingTermsDraft): BookingTermsErrors {
  return {
    minRoomsWithoutBuyout: numberRuleError(draft.minRoomsWithoutBuyout, {
      min: 0,
      max: 10_000,
      places: 0,
      message: "Minimum rooms is a whole number, from 0 to 10,000",
    }),
    minNights: numberRuleError(draft.minNights, {
      min: 1,
      max: 60,
      places: 0,
      message: "Minimum nights is a whole number, from 1 to 60",
    }),
  };
}

type BookingTermsBody = Pick<
  HotelCreateRequest,
  | "weddingBuyoutPolicy"
  | "minRoomsWithoutBuyout"
  | "minNights"
  | "parallelFunctions"
  | "bookingNotes"
>;

/** The booking terms part of the body: "unset" and blanks as null. */
export function bookingTermsBody(draft: BookingTermsDraft): BookingTermsBody {
  return {
    weddingBuyoutPolicy: draft.weddingBuyoutPolicy === "unset" ? null : draft.weddingBuyoutPolicy,
    minRoomsWithoutBuyout: numberOrNull(draft.minRoomsWithoutBuyout),
    minNights: numberOrNull(draft.minNights),
    parallelFunctions: draft.parallelFunctions === "unset" ? null : draft.parallelFunctions,
    bookingNotes: textOrNull(draft.bookingNotes),
  };
}
