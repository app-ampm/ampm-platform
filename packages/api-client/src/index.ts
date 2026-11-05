/**
 * @ampm/api-client: the typed client and the TanStack Query hooks the apps use (api.md). Apps never
 * hand-write fetch calls.
 */
export const API_CLIENT_VERSION = "0.1.0";

export { createApiClient } from "./client";
export type { ApiClient, ApiClientOptions, RequestOptions } from "./client";
export { ApiProvider, createQueryClient, useApiClient } from "./provider";
export type { ApiProviderProps } from "./provider";
export { ME_QUERY_KEY, useMe } from "./hooks/use-me";
export { NOTIFICATIONS_QUERY_KEY, useNotifications } from "./hooks/use-notifications";
export { useSubmitEnquiry } from "./hooks/use-submit-enquiry";
export { LEADS_QUERY_KEY, useLeads } from "./hooks/use-leads";
export { leadQueryKey, useLead } from "./hooks/use-lead";
export { useLeadActivities } from "./hooks/use-lead-activities";
export { useConvertLead } from "./hooks/use-convert-lead";
export { useDevLogin } from "./hooks/use-dev-login";
export { PLANS_QUERY_KEY, usePlans } from "./hooks/use-plans";
export { usePortalSubscribe } from "./hooks/use-portal-subscribe";
export { useCompletePayment } from "./hooks/use-complete-payment";
export { HOTELS_QUERY_KEY, useHotels } from "./hooks/use-hotels";
export { hotelQueryKey, useHotel } from "./hooks/use-hotel";
export { SAVED_HOTELS_QUERY_KEY, useSavedHotels } from "./hooks/use-saved-hotels";
export { useSaveHotel } from "./hooks/use-save-hotel";
export { useUnsaveHotel } from "./hooks/use-unsave-hotel";
// Module D consultancy (feature 10.1): the client side of hotel enquiries (CP-07/08).
export {
  HOTEL_ENQUIRIES_QUERY_KEY,
  hotelEnquiryQueryKey,
  useHotelEnquiries,
  useHotelEnquiry,
  type HotelEnquiriesQuery,
} from "./hooks/use-hotel-enquiries";
export { useRequestHotelAssistance } from "./hooks/use-request-hotel-assistance";
export { useUpdateEnquiryNote } from "./hooks/use-update-enquiry-note";
export {
  SERVICE_AGREEMENTS_QUERY_KEY,
  serviceAgreementQueryKey,
  useServiceAgreement,
  useServiceAgreements,
} from "./hooks/use-service-agreements";
export { useAcceptServiceAgreement } from "./hooks/use-accept-service-agreement";
