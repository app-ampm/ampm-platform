import type {
  HotelDuplicateHint,
  HotelInfoRequestEventView,
  HotelInfoRequestFullView,
  HotelInfoRequestLinkIssued,
  HotelInfoRequestSummaryView,
} from "@ampm/core";

export {
  destinationListItemFixture,
  failure,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "../hotels-admin/hotels-admin.test-utils";
export { staffMeFixture } from "../accounts/accounts.test-utils";

/*
 * Test helpers for hotel information requests (D-188 §7): a request in each audience's model, an event,
 * a duplicate hint and the create answer with its link, all synthetic. Imported by tests only.
 */

export const REQUEST_ID = "018f0000-0000-7000-8000-0000000c2001";
export const NEW_REQUEST_ID = "018f0000-0000-7000-8000-0000000c2002";
const STAFF_ID = "018f0000-0000-7000-8000-0000000c20aa";
const AT = "2026-11-24T10:00:00.000Z";

/** The link a create or reissue answers, once: synthetic, never a real secret. */
export const ISSUED_URL = "https://site.synthetic.example/hotel-form#k=hfl_synthetic-link-secret";

/** A live request for The Lakeside Palace, as a reader without the update key gets it (SM, PM). */
export function requestSummaryFixture(
  overrides: Partial<HotelInfoRequestSummaryView> = {},
): HotelInfoRequestSummaryView {
  return {
    id: REQUEST_ID,
    reference: "HIR-2026-0001",
    kind: "onboarding",
    target: "existing",
    status: "open",
    isTest: false,
    hotelId: "018f0000-0000-7000-8000-0000000c0001",
    hotelName: "The Lakeside Palace",
    proposedName: null,
    proposedDestinationId: null,
    proposedWebAddress: null,
    destinationName: "Udaipur",
    officialWebsite: null,
    switchboardPhone: null,
    switchboardSource: null,
    displayLabel: null,
    staffNote: null,
    expiresAt: "2026-12-24T10:00:00.000Z",
    isExpired: false,
    statusOnlyUntil: null,
    tokenGeneration: 1,
    linkIssuedAt: AT,
    linkEmailedAt: null,
    revokedAt: null,
    revokeReason: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

/** One entry of a request's history: its creation by staff, unless overridden. */
export function requestEventFixture(
  overrides: Partial<HotelInfoRequestEventView> = {},
): HotelInfoRequestEventView {
  return {
    id: "018f0000-0000-7000-8000-0000000c2101",
    eventType: "created",
    actorKind: "staff",
    actorUserId: STAFF_ID,
    detail: { generation: 1, expiresAt: "2026-12-24T10:00:00.000Z" },
    occurredAt: AT,
    ...overrides,
  };
}

/** The same request as a holder of the update key gets it (SA, HT): the recipient and the events. */
export function requestFullFixture(
  overrides: Partial<HotelInfoRequestFullView> = {},
): HotelInfoRequestFullView {
  return {
    ...requestSummaryFixture(),
    recipientName: "Synthetic Sales Desk",
    recipientEmail: "sales@lakeside.example",
    extendableUntil: "2027-02-22T10:00:00.000Z",
    events: [requestEventFixture()],
    ...overrides,
  };
}

/** A request for a proposed new hotel, in the summary model. */
export function newHotelRequestFixture(
  overrides: Partial<HotelInfoRequestSummaryView> = {},
): HotelInfoRequestSummaryView {
  return requestSummaryFixture({
    id: NEW_REQUEST_ID,
    reference: "HIR-2026-0002",
    target: "new",
    hotelId: null,
    hotelName: null,
    proposedName: "The Desert Fort",
    proposedDestinationId: "018f0000-0000-7000-8000-0000000c0002",
    proposedWebAddress: "https://desert-fort.example",
    destinationName: "Jaisalmer",
    ...overrides,
  });
}

/** The create (or reissue) answer: the request, the link once, and what became of its email. */
export function linkIssuedFixture(
  overrides: Partial<HotelInfoRequestLinkIssued> = {},
): HotelInfoRequestLinkIssued {
  return {
    request: requestFullFixture(),
    link: { url: ISSUED_URL, expiresAt: "2026-12-24T10:00:00.000Z" },
    email: "not_requested",
    ...overrides,
  };
}

/** A catalogue hotel the Invite sheet hints: the same name, not deleted. */
export function duplicateHintFixture(
  overrides: Partial<HotelDuplicateHint> = {},
): HotelDuplicateHint {
  return {
    hotelId: "018f0000-0000-7000-8000-0000000c0003",
    name: "The Desert Fort",
    status: "active",
    destinationName: "Jaisalmer",
    website: "https://desert-fort.example",
    deletedAt: null,
    reasons: ["name"],
    sharedHost: false,
    ...overrides,
  };
}
