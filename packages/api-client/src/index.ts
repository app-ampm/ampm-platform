/*
 * @ampm/api-client: the typed client and the TanStack Query hooks the apps use (api.md). Apps never
 * hand-write fetch calls.
 */

export { createApiClient } from "./client";
export type { ApiClient, ApiClientOptions, RequestOptions } from "./client";
export { ApiProvider, createQueryClient, useApiClient } from "./provider";
export type { ApiProviderProps } from "./provider";
export { useMediaUrl } from "./hooks/use-media-url";
export { ME_QUERY_KEY, meQueryOptions, useMe, type UseMeOptions } from "./hooks/use-me";
export {
  staffAccessFor,
  staffPolicyPrincipal,
  staffRoleNames,
  useStaffAccess,
  type StaffAccess,
  type StaffAccessSource,
} from "./staff-access";
export { useSubmitEnquiry } from "./hooks/use-submit-enquiry";
export { LEADS_QUERY_KEY, useLeads } from "./hooks/use-leads";
export { ACCOUNTS_QUERY_KEY, accountQueryKey, useAccount, useAccounts } from "./hooks/use-accounts";
export {
  useAccountContactInviteLink,
  useAddAccountContact,
  useInviteAccountContact,
  useRemoveAccountContact,
  useUpdateAccount,
  useUpdateAccountContact,
} from "./hooks/use-account-actions";
export {
  SUBSCRIPTIONS_QUERY_KEY,
  useAccountSubscriptions,
  useRecordPayment,
} from "./hooks/use-subscriptions";
export { PAYMENTS_QUERY_KEY, usePayments, type PaymentsQuery } from "./hooks/use-payments";
export {
  SUBSCRIPTION_REPORT_QUERY_KEY,
  useSubscriptionReport,
  useSubscriptionReportExport,
  type SubscriptionReportFilter,
} from "./hooks/use-subscription-report";
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
  useResetStaffAuthenticator,
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
export { useDemoSignIn, useDevInviteSignIn, useDevLogin } from "./hooks/use-dev-login";
export { useCreateDemoClient, useRequestDevOtp, useVerifyDevOtp } from "./hooks/use-dev-otp";
export { useActivate } from "./hooks/use-activate";
export type { ActivateVariables } from "./hooks/use-activate";
export { PLANS_QUERY_KEY, usePlans } from "./hooks/use-plans";
export { usePortalSubscribe } from "./hooks/use-portal-subscribe";
export { useCompletePayment } from "./hooks/use-complete-payment";
export { useVerifyPayment } from "./hooks/use-verify-payment";
export { HOTELS_QUERY_KEY, useHotels } from "./hooks/use-hotels";
export { hotelQueryKey, useHotel } from "./hooks/use-hotel";
export { SAVED_HOTELS_QUERY_KEY, useSavedHotels } from "./hooks/use-saved-hotels";
// Staff read of clients' saved hotels (`hotels.saved_hotels.read`): the client hub and the wishlists list.
export {
  CLIENT_SAVED_HOTELS_QUERY_KEY,
  clientSavedHotelsPath,
  useClientSavedHotels,
  type ClientSavedHotelsQuery,
} from "./hooks/use-client-saved-hotels";
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
  useCreateDestination,
  useCreateHotel,
  useStaffDestinations,
  useStaffHotel,
  useStaffHotels,
  useUpdateDestination,
  useUpdateHotel,
} from "./hooks/use-staff-hotels";
// Hotel information requests, the staff side (D-188 §3 and §7): listed in their own barrel.
export * from "./hotel-info-requests";
export {
  hotelImportApplyPath,
  hotelImportPreviewPath,
  useHotelImportApply,
  useHotelImportPreview,
  type HotelImportApplyInput,
  type HotelImportPreviewInput,
} from "./hooks/use-hotel-import";
export {
  HOTEL_CUISINE_OPTIONS_QUERY_KEY,
  useHotelCuisineOptions,
} from "./hooks/use-hotel-cuisine-options";
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
  useAttachReferenceConsent,
  useCreateHotelReference,
  useDeleteHotelReference,
  useHotelReferences,
  useReferenceConsentLink,
  useUpdateHotelReference,
  weddingReferencesQueryKey,
} from "./hooks/use-hotel-references";
export {
  hotelDocumentsQueryKey,
  hotelDocumentUploadPath,
  useDeleteHotelDocument,
  useHotelDocumentLink,
  useHotelDocuments,
  useUploadHotelDocument,
  type HotelDocumentUploadInput,
} from "./hooks/use-hotel-documents";
export {
  hotelMediaQueryKey,
  useAddHotelMedia,
  useDeleteMedia,
  useHotelMedia,
  useMediaDownloadUrl,
  useUpdateMedia,
  type AddHotelMediaInput,
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
export { useWithdrawEnquiry } from "./hooks/use-withdraw-enquiry";
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
  staffEnquiriesPath,
  staffEnquiryQueryKey,
  useStaffEnquiries,
  useStaffEnquiry,
  useStaffEnquiryPipeline,
  useTransitionEnquiry,
  type StaffEnquiriesQuery,
} from "./hooks/use-staff-enquiries";
// Who holds an enquiry: the owner picker's team list and the internal-fields edit that assigns it.
export {
  ENQUIRY_ASSIGNEES_QUERY_KEY,
  useEnquiryAssignees,
  useUpdateStaffEnquiry,
} from "./hooks/use-enquiry-assignment";
export {
  STAFF_PROPOSALS_QUERY_KEY,
  staffProposalsQueryKey,
  useCreateProposal,
  useReviseProposal,
  useShareProposal,
  useStaffProposals,
  useUpdateProposal,
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
  useAttachMilestoneContract,
  useMilestoneContractLink,
  useStaffBookingMilestones,
  useTransitionBookingMilestone,
} from "./hooks/use-staff-booking-milestones";
export {
  AGREEMENT_WAITING_REFRESH_MS,
  STAFF_SERVICE_AGREEMENTS_QUERY_KEY,
  useAgreementSignedCopyLink,
  useCreateServiceAgreement,
  useMarkAgreementSignedOffline,
  useStaffServiceAgreements,
  useTransitionServiceAgreement,
  type StaffServiceAgreementsQuery,
} from "./hooks/use-staff-service-agreements";
export { SERVICE_TYPES_QUERY_KEY, useServiceTypes } from "./hooks/use-service-types";
export { useSignIn, useSignInCode, useSignOut } from "./hooks/use-staff-sign-in";
export {
  useClientSignIn,
  useConfirmClientActivation,
  useRequestClientCode,
  useSendClientActivationCode,
} from "./hooks/use-client-sign-in";
export {
  useActivationConfirm,
  useActivationPassword,
  useForgotPassword,
  useInvitationPreview,
  useResetPassword,
} from "./hooks/use-account-setup";
