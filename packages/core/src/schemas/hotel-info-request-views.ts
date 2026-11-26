import { z } from "zod";

import { isoDateTime, page, uuid } from "./common.js";
import { hotelFormMode } from "./config.js";
import {
  hotelInfoRequestActorKind,
  hotelInfoRequestEventType,
  hotelInfoRequestKind,
  hotelInfoRequestStatus,
  hotelInfoRequestTarget,
} from "./hotel-info-requests.js";
import { hotelStatus } from "./hotels-admin.js";

/*
 * What the staff routes of hotel information requests answer (D-188 §3): one response model per audience
 * (security.md). Permission-matrix §5.3 gives SM and PM "R" on the row, answered as the summary: every
 * INTERNAL column, without the recipient (RESTRICTED-CONTACT) or the history. SA and HT, and any principal
 * whose grants hold `hotels.info_requests.update`, get the full view. A field outside a model is absent,
 * never null. The link's secret is in no model: it is in the create and reissue answers' `link` alone.
 */

/** The latest events the full view carries, newest first. */
export const HOTEL_INFO_REQUEST_EVENTS_SHOWN = 20;
/** The most hotels the duplicate hints name. */
export const HOTEL_DUPLICATE_HINTS_MAX = 20;

/** Every reader of `hotels.info_requests.read` (SA, SM, HT, PM). */
const summaryFields = {
  id: uuid,
  /** `HIR-<year>-<n>`. */
  reference: z.string(),
  kind: hotelInfoRequestKind,
  target: hotelInfoRequestTarget,
  status: hotelInfoRequestStatus,
  isTest: z.boolean(),
  /** The catalogue hotel: set for an existing hotel, and for a new one once it is merged. */
  hotelId: uuid.nullable(),
  /** The catalogue's name for that hotel. */
  hotelName: z.string().nullable(),
  /** A new hotel's proposed identity, as staff entered it. */
  proposedName: z.string().nullable(),
  proposedDestinationId: uuid.nullable(),
  proposedWebAddress: z.string().nullable(),
  /** The hotel's destination, or a new hotel's proposed one. */
  destinationName: z.string().nullable(),
  officialWebsite: z.string().nullable(),
  /** E.164. */
  switchboardPhone: z.string().nullable(),
  switchboardSource: z.string().nullable(),
  displayLabel: z.string().nullable(),
  staffNote: z.string().nullable(),
  /** When the link stops working; expiry is never a status. */
  expiresAt: isoDateTime,
  /** Whether `expiresAt` has passed, at the time of the answer. */
  isExpired: z.boolean(),
  statusOnlyUntil: isoDateTime.nullable(),
  /** 1, plus 1 at each reissue. */
  tokenGeneration: z.number().int().min(1),
  /** When the current link was issued, and when it was emailed (null when it has not been). */
  linkIssuedAt: isoDateTime,
  linkEmailedAt: isoDateTime.nullable(),
  revokedAt: isoDateTime.nullable(),
  revokeReason: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};

/**
 * A request as a reader without the update key gets it (SM, PM), and as every list row is.
 *
 * @example
 * hotelInfoRequestSummaryView.parse(row); // no recipientName, recipientEmail or events
 */
export const hotelInfoRequestSummaryView = z.object(summaryFields).strict();
export type HotelInfoRequestSummaryView = z.infer<typeof hotelInfoRequestSummaryView>;

/** One value of an event's detail: text, a number, a flag, null or a list of names, never an object. */
const eventDetailValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);

/**
 * One entry of a request's history. `detail` is masked and holds no link: `created` has `generation` and
 * `expiresAt`; `link_reissued` and `link_emailed` have `generation`; `share_recorded` has `channel` and
 * maybe `note`; `updated` has `fields` (the names changed, never their values); `expiry_extended` has
 * `from` and `to`; `revoked` has `fromStatus` and `cause` (`staff` or `hotel_deleted`). A hotel person's
 * (D-189 §6): `code_requested` has `challengeId` and `delivery` (`sms` or `screen`); `person_verified` has
 * `challengeId`, `delivery` and `returning`; `person_updated` has `fields`. The form's own (D-190 §1), a
 * hotel person's too: `submitted` has `revision` (the revision written); `correction_requested` has
 * `correctionId`, never the message; `consent_withdrawn` has `kind` (`display_authorisation` or `all`);
 * `removal_requested` has none. None holds a name, a mobile, a code or anything a hotel typed.
 */
export const hotelInfoRequestEventView = z
  .object({
    id: uuid,
    eventType: hotelInfoRequestEventType,
    actorKind: hotelInfoRequestActorKind,
    /** The staff user, when staff acted. */
    actorUserId: uuid.nullable(),
    detail: z.record(z.string(), eventDetailValue).nullable(),
    occurredAt: isoDateTime,
  })
  .strict();
export type HotelInfoRequestEventView = z.infer<typeof hotelInfoRequestEventView>;

/**
 * A request as a holder of `hotels.info_requests.update` gets it (SA, HT): the summary, the recipient as
 * AMPM entered them, the latest expiry an extension may set (null once the request is no longer live),
 * and the latest events, newest first.
 */
export const hotelInfoRequestFullView = z
  .object({
    ...summaryFields,
    recipientName: z.string().nullable(),
    recipientEmail: z.string().nullable(),
    extendableUntil: isoDateTime.nullable(),
    events: z.array(hotelInfoRequestEventView).max(HOTEL_INFO_REQUEST_EVENTS_SHOWN),
  })
  .strict();
export type HotelInfoRequestFullView = z.infer<typeof hotelInfoRequestFullView>;

/** One request, in the caller's model: `GET`, `PATCH`, share-record and revoke answer it. */
export const hotelInfoRequestDetail = z.union([
  hotelInfoRequestFullView,
  hotelInfoRequestSummaryView,
]);
export type HotelInfoRequestDetail = z.infer<typeof hotelInfoRequestDetail>;

/** The inbox and a hotel's history: summaries, by cursor. */
export const hotelInfoRequestPage = page(hotelInfoRequestSummaryView);
export type HotelInfoRequestPage = z.infer<typeof hotelInfoRequestPage>;

/**
 * What became of the link's email: `queued` to the recipient; `not_requested`; `mode_off` (the hotel
 * form's mode sends nothing to a hotel); `mode_test_only` (only a test request's link is emailed); or
 * `failed` to queue (the link stands: copy it, or reissue it with the email).
 */
export const hotelInfoRequestLinkEmail = z.enum([
  "queued",
  "not_requested",
  "mode_off",
  "mode_test_only",
  "failed",
]);
export type HotelInfoRequestLinkEmail = z.infer<typeof hotelInfoRequestLinkEmail>;

/** The link, shown once: `<PUBLIC_SITE_URL>/hotel-form#k=<secret>`. */
export const hotelInfoRequestIssuedLink = z
  .object({ url: z.string().url(), expiresAt: isoDateTime })
  .strict();
export type HotelInfoRequestIssuedLink = z.infer<typeof hotelInfoRequestIssuedLink>;

/**
 * The create and reissue answer: the request in the caller's model, the link (never shown again, and
 * never stored but as a hash), and what became of its email.
 */
export const hotelInfoRequestLinkIssued = z
  .object({
    request: hotelInfoRequestDetail,
    link: hotelInfoRequestIssuedLink,
    email: hotelInfoRequestLinkEmail,
  })
  .strict();
export type HotelInfoRequestLinkIssued = z.infer<typeof hotelInfoRequestLinkIssued>;

/**
 * Why a hotel is a duplicate hint: its name or one of its name variants matches the name typed (case and
 * accents ignored), its website is the address typed (scheme, `www.`, query and trailing slash ignored),
 * or its website is on the same host.
 */
export const hotelDuplicateHintReason = z.enum([
  "name",
  "name_variant",
  "web_address",
  "website_host",
]);
export type HotelDuplicateHintReason = z.infer<typeof hotelDuplicateHintReason>;

/**
 * A catalogue hotel the Invite sheet should show before a new hotel is proposed. A deleted hotel is a
 * hint too (`deletedAt` set): its slug and web address stay taken. `sharedHost` marks weak evidence: the
 * host is shared by two or more hotels, as a brand's domain is.
 */
export const hotelDuplicateHint = z
  .object({
    hotelId: uuid,
    name: z.string(),
    status: hotelStatus,
    destinationName: z.string(),
    website: z.string().nullable(),
    deletedAt: isoDateTime.nullable(),
    reasons: z.array(hotelDuplicateHintReason).min(1),
    sharedHost: z.boolean(),
  })
  .strict();
export type HotelDuplicateHint = z.infer<typeof hotelDuplicateHint>;

/** The duplicate hints, strongest first, twenty at most. */
export const hotelDuplicateHints = z
  .object({ hints: z.array(hotelDuplicateHint).max(HOTEL_DUPLICATE_HINTS_MAX) })
  .strict();
export type HotelDuplicateHints = z.infer<typeof hotelDuplicateHints>;

/**
 * `GET /hotels-admin/hotel-form-mode`: the hotel form's mode alone, read past the configuration cache, so
 * the Send request and Invite a new hotel sheets say what "Email it" will do before staff send (D-188 §6
 * and §7). Every reader of `hotels.info_requests.read` may see it; the rest of `hotel_form.policy` (the
 * reply-to, the help contact, the limits) stays in the admin console.
 *
 * @example
 * hotelFormModeView.parse({ mode: "test_only" });
 */
export const hotelFormModeView = z.object({ mode: hotelFormMode }).strict();
export type HotelFormModeView = z.infer<typeof hotelFormModeView>;
