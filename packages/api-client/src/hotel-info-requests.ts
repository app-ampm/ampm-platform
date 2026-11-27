/*
 * Hotel information requests, the staff side (D-188 §3 and §7): the inbox (TW-99), a hotel's request
 * panel, and the Send request and Invite a new hotel sheets. Staff-only; gated server-side. Re-exported
 * whole by the package index, which is at its length limit.
 */

export {
  HOTEL_FORM_MODE_QUERY_KEY,
  HOTEL_INFO_REQUESTS_QUERY_KEY,
  hotelDuplicateHintsPath,
  hotelInfoRequestHistoryQueryKey,
  hotelInfoRequestQueryKey,
  hotelInfoRequestsPath,
  useHotelDuplicateHints,
  useHotelFormMode,
  useHotelInfoRequest,
  useHotelInfoRequestHistory,
  useHotelInfoRequests,
  useHotelInfoRequestsToReview,
  type HotelDuplicateHintsFound,
  type HotelInfoRequestsQuery,
  type HotelInfoRequestsToReview,
} from "./hooks/use-hotel-info-requests";
export {
  useCreateHotelInfoRequest,
  useRecordHotelInfoRequestShare,
  useReissueHotelInfoRequest,
  useRevokeHotelInfoRequest,
  useUpdateHotelInfoRequest,
  type HotelInfoRequestChange,
} from "./hooks/use-hotel-info-request-actions";
