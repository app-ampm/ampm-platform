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
