/*
 * The hotel form's public routes, the website's side (D-189 §4, §5): the link's state, the code, the
 * session's `me` and sign-out. Anonymous before the code, the form's own session after it, never a
 * staff or client token. Re-exported whole by the package index, which is at its length limit.
 */

export {
  HOTEL_FORM_ME_QUERY_KEY,
  hotelFormCalls,
  hotelFormMeQueryOptions,
  useHotelFormMe,
  useOpenHotelForm,
  useRequestHotelFormCode,
  useSignOutOfHotelForm,
  useUpdateHotelFormMe,
  useVerifyHotelFormCode,
  type HotelFormMeChange,
  type HotelFormSessionCall,
} from "./hooks/use-hotel-form";
