/**
 * @ampm/api-client: the typed client and the TanStack Query hooks the apps use (api.md). Apps never
 * hand-write fetch calls.
 */
export const API_CLIENT_VERSION = "0.1.0";

export { createApiClient } from "./client";
export type { ApiClient, ApiClientOptions, RequestOptions } from "./client";
export { ApiProvider, createQueryClient, useApiClient } from "./provider";
export type { ApiProviderProps } from "./provider";
export { ME_QUERY_KEY, meQueryOptions, useMe, type UseMeOptions } from "./hooks/use-me";
export { useSubmitEnquiry } from "./hooks/use-submit-enquiry";
export { LEADS_QUERY_KEY, useLeads } from "./hooks/use-leads";
export { ACCOUNTS_QUERY_KEY, accountQueryKey, useAccount, useAccounts } from "./hooks/use-accounts";
export {
  SUBSCRIPTIONS_QUERY_KEY,
  useAccountSubscriptions,
  useRecordPayment,
} from "./hooks/use-subscriptions";
export { PAYMENTS_QUERY_KEY, usePayments, type PaymentsQuery } from "./hooks/use-payments";
export { leadQueryKey, useLead } from "./hooks/use-lead";
export { useLeadActivities } from "./hooks/use-lead-activities";
export { useConvertLead } from "./hooks/use-convert-lead";
export {
  useAddLeadActivity,
  useAssignLeadOwner,
  useMergeLead,
  useUpdateLead,
} from "./hooks/use-lead-actions";
export { LEAD_FUNNEL_QUERY_KEY, useLeadFunnel } from "./hooks/use-lead-funnel";
// Module A admin console (feature 5.1): the staff directory (TW-90). Staff-only; gated server-side.
export {
  STAFF_USERS_QUERY_KEY,
  staffUserQueryKey,
  useStaffUser,
  useStaffUsers,
} from "./hooks/use-staff-users";
export {
  useInviteStaffUser,
  useReinviteStaffUser,
  useSetStaffUserStatus,
  useUpdateStaffUser,
} from "./hooks/use-staff-user-mutations";
export {
  ASSIGNABLE_ROLES_QUERY_KEY,
  CAPABILITIES_QUERY_KEY,
  ROLES_QUERY_KEY,
  useAssignableRoles,
  useAssignStaffRole,
  useCapabilities,
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUnassignStaffRole,
  useUpdateRole,
} from "./hooks/use-staff-roles";
export { AUDIT_EVENTS_QUERY_KEY, useAuditEvents } from "./hooks/use-audit-events";
export { useAuditExport } from "./hooks/use-audit-export";
export { NOTIFICATIONS_QUERY_KEY, useNotifications } from "./hooks/use-notifications";
export {
  NOTIFICATION_TEMPLATES_QUERY_KEY,
  useNotificationTemplates,
  useUpdateNotificationTemplates,
} from "./hooks/use-notification-templates";
export {
  CONFIGURATIONS_QUERY_KEY,
  useConfigurations,
  useUpdateConfiguration,
  type UpdateConfigurationInput,
} from "./hooks/use-configurations";
export {
  useCursorList,
  type CursorListOptions,
  type CursorListResult,
  type CursorPage,
} from "./hooks/use-cursor-list";
export { useDevLogin } from "./hooks/use-dev-login";
export { useActivate } from "./hooks/use-activate";
export { PLANS_QUERY_KEY, usePlans } from "./hooks/use-plans";
export { usePortalSubscribe } from "./hooks/use-portal-subscribe";
export { useCompletePayment } from "./hooks/use-complete-payment";
export { HOTELS_QUERY_KEY, useHotels } from "./hooks/use-hotels";
export { hotelQueryKey, useHotel } from "./hooks/use-hotel";
export { SAVED_HOTELS_QUERY_KEY, useSavedHotels } from "./hooks/use-saved-hotels";
export { SAVED_HOTEL_IDS_QUERY_KEY, useSavedHotelIds } from "./hooks/use-saved-hotel-ids";
export { useSaveHotel } from "./hooks/use-save-hotel";
export { useSaveHotels } from "./hooks/use-save-hotels";
export { useCompare } from "./hooks/use-compare";
export { DESTINATIONS_QUERY_KEY, useDestinations } from "./hooks/use-destinations";
export { useUnsaveHotel } from "./hooks/use-unsave-hotel";
export { useUpdateSavedNote } from "./hooks/use-update-saved-note";
// H1.1 staff hotel catalogue + photo management (Module C + Module N media). Staff-only; gated server-side.
export {
  STAFF_DESTINATIONS_QUERY_KEY,
  STAFF_HOTELS_QUERY_KEY,
  staffHotelQueryKey,
  useCreateHotel,
  useStaffDestinations,
  useStaffHotel,
  useStaffHotels,
  useUpdateHotel,
} from "./hooks/use-staff-hotels";
export { useHotelImport } from "./hooks/use-hotel-import";
export {
  useCreateContact,
  useCreateRoom,
  useCreateVenue,
  useDeleteContact,
  useDeleteRoom,
  useDeleteVenue,
  useUpdateContact,
  useUpdateRoom,
  useUpdateVenue,
} from "./hooks/use-hotel-subresources";
export {
  rateCardsQueryKey,
  useAddRateItem,
  useCreateRateCard,
  useDeleteRateCard,
  useDeleteRateItem,
  useHotelRateCards,
  useHotelVerifications,
  useRecordVerification,
  useUpdateRateCard,
  useUpdateRateItem,
  useVerifyRateCard,
  verificationsQueryKey,
} from "./hooks/use-hotel-rates";
export {
  hotelMediaQueryKey,
  useAddHotelPhoto,
  useDeleteMedia,
  useHotelMedia,
  useMediaDownloadUrl,
  useUpdateMedia,
  type AddHotelPhotoInput,
} from "./hooks/use-hotel-media";
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
export { siteVisitsQueryKey, useSiteVisits } from "./hooks/use-site-visits";
export { useUpdateSiteVisitFeedback } from "./hooks/use-update-site-visit-feedback";
export {
  hotelProposalQueryKey,
  hotelProposalsQueryKey,
  useHotelProposal,
  useHotelProposals,
} from "./hooks/use-hotel-proposals";
export { useDecideHotelProposal } from "./hooks/use-decide-hotel-proposal";
export {
  bookingMilestoneQueryKey,
  bookingMilestonesQueryKey,
  useBookingMilestone,
  useBookingMilestones,
} from "./hooks/use-booking-milestones";
// Module D consultancy (feature 10.x, Slice 2): the STAFF side of the pipeline (consultancy-admin + crm),
// read as the internal view and driven by status transitions. Staff-only — gated server-side by role.
export {
  STAFF_ENQUIRIES_QUERY_KEY,
  staffEnquiryQueryKey,
  useStaffEnquiries,
  useStaffEnquiry,
  useTransitionEnquiry,
  type StaffEnquiriesQuery,
} from "./hooks/use-staff-enquiries";
export {
  STAFF_PROPOSALS_QUERY_KEY,
  staffProposalsQueryKey,
  useCreateProposal,
  useReviseProposal,
  useShareProposal,
  useStaffProposals,
} from "./hooks/use-staff-proposals";
export {
  STAFF_SITE_VISITS_QUERY_KEY,
  staffSiteVisitsQueryKey,
  useCreateSiteVisit,
  useStaffSiteVisits,
  useTransitionSiteVisit,
} from "./hooks/use-staff-site-visits";
export {
  STAFF_MILESTONES_QUERY_KEY,
  staffMilestonesQueryKey,
  useCreateBookingMilestone,
  useStaffBookingMilestones,
  useTransitionBookingMilestone,
} from "./hooks/use-staff-booking-milestones";
export {
  STAFF_SERVICE_AGREEMENTS_QUERY_KEY,
  useCreateServiceAgreement,
  useStaffServiceAgreements,
  useTransitionServiceAgreement,
  type StaffServiceAgreementsQuery,
} from "./hooks/use-staff-service-agreements";
export { SERVICE_TYPES_QUERY_KEY, useServiceTypes } from "./hooks/use-service-types";
