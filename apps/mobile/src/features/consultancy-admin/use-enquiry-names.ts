import { useAccount, useStaffHotel } from "@ampm/api-client";
import type { HotelEnquiryStaffView } from "@ampm/core";

export interface EnquiryNames {
  /** The hotel's name, once its record has arrived; undefined while it loads or if it cannot. */
  readonly hotelName: string | undefined;
  /** The client account's name, on the same terms. */
  readonly clientName: string | undefined;
}

/**
 * The names the open enquiry's header leads with. The staff enquiry view carries only the hotel's and
 * the account's ids, so they are read through the staff hotel and account queries: one of each for
 * the open enquiry, never one per queue card. A refusal (an account outside a project manager's
 * reach) is not retried and simply leaves that name out. `hotelName` and `accountName` on the staff
 * view would make both requests unnecessary.
 */
export function useEnquiryNames(
  enquiry: Pick<HotelEnquiryStaffView, "hotelId" | "accountId">,
): EnquiryNames {
  const hotel = useStaffHotel(enquiry.hotelId);
  const account = useAccount(enquiry.accountId);
  return { hotelName: hotel.data?.name, clientName: account.data?.name };
}
