/*
 * The hotel form's public routes, the website's side (D-189 §4, §5; D-190 §3): the link's state, the code,
 * the session's `me` and sign-out; then the form itself: the draft, a section's autosave, submit, a
 * correction and consent withdrawal. Anonymous before the code, the form's own session after it, never a
 * staff or client token. Re-exported whole by the package index, which is at its length limit.
 */

export {
  forgetHotelForm,
  HOTEL_FORM_ME_QUERY_KEY,
  HOTEL_FORM_QUERY_FAMILY,
  hotelFormCalls,
  hotelFormMeQueryOptions,
  useHotelFormMe,
  useOpenHotelForm,
  useRequestHotelFormCode,
  useSignOutOfHotelForm,
  useForgetHotelForm,
  useUpdateHotelFormMe,
  useVerifyHotelFormCode,
  type HotelFormMeChange,
  type HotelFormSessionCall,
} from "./hooks/use-hotel-form";

export {
  HOTEL_FORM_DRAFT_QUERY_KEY,
  hotelFormDraftCalls,
  hotelFormDraftQueryOptions,
  useHotelFormDraft,
  useRequestHotelFormCorrection,
  useSaveHotelFormSection,
  useSubmitHotelForm,
  useWithdrawHotelFormConsent,
  type HotelFormCorrectionCall,
  type HotelFormSectionSaveCall,
  type HotelFormSubmitCall,
  type HotelFormWithdrawalCall,
} from "./hooks/use-hotel-form-draft";
