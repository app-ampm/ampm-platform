// Every schema module is re-exported whole: each file exports only its public contracts (module-private
// helpers are plain `const`), and no name collides across modules, so `export *` is unambiguous.
export * from "./common";
export * from "./audit-log";
export * from "./admin-roles";
export * from "./permission-sets";
export * from "./config";
export * from "./auth";
export * from "./sign-in";
export * from "./client-logins";
export * from "./health";
export * from "./staff-users";
export * from "./identity";
export * from "./notification";
export * from "./field-note";
export * from "./leads";
export * from "./accounts";
export * from "./plans";
export * from "./subscriptions";
// Payments (payments.ts): the finance ledger (`paymentFinanceView` + list/page), the client receipt and
// the manual-payment request.
export * from "./payments";
export * from "./subscription-report"; // §5.16 report, every name `subscriptionReport`-prefixed (D-127)
// Module C hotels: client discovery (hotels.ts) and the staff workspace (hotels-admin.ts, feature 9.1),
// whose hotel is one model per audience (hotel-staff-views.ts, D-171).
export * from "./hotels";
export * from "./hotels-admin";
export * from "./hotel-catalogue"; // the D-178 hotel fields (location, access, booking terms, food)
export * from "./hotel-rooms-venues"; // the D-178 room and venue fields, staff-only until Slice 12
export * from "./hotel-import"; // the staff spreadsheet import (D-181): the kinds, the hotels template, results
export * from "./hotel-import-cells"; // how an import cell reads (lists, enums, layouts, capacities, money)
export * from "./hotel-import-rooms-venues"; // the Rooms and Venues templates (Slice 3)
export * from "./hotel-import-rates"; // the Rates template (Slice 4)
export * from "./hotel-import-compare"; // what each kind compares and hashes into its version token
export * from "./hotel-staff-views";
export * from "./saved-hotels-staff"; // staff read of clients' saved hotels, every name `savedHotelStaff`-prefixed
export * from "./hotel-rates";
export * from "./hotel-references";
export * from "./media";
// Module D consultancy (consultancy.ts), feature 10.1. The Module N documents/document_access_links
// TABLES land in 10.1 as forward schema; their contract + service arrive with feature 10.2 (first upload).
export * from "./consultancy";
// Module B paid-service agreements (service-agreements.ts), feature 10.2. GP-5: an active hotel-assistance
// agreement unblocks work beyond availability checking on its linked enquiry (the AC-05.7 gate).
export * from "./service-agreements";
// Module D hotel site visits (site-visits.ts), feature 10.3. Dual-audience: the client sees date/status
// + own feedback; attendees and the internal outcome never reach a client (AC-05.5).
export * from "./site-visits";
// Module D hotel proposals (hotel-proposals.ts), feature 10.4. Two response models: the client total +
// client-visible lines for the client; the internal total + derived margin only for read_internal_amount
// holders (AC-05.2). Versioned + immutable once shared (AC-09).
export * from "./hotel-proposals";
// Module D hotel booking milestones (booking-milestones.ts), feature 10.5. One `amount` column, absent
// from the client view unless the W-14 config flag is on; a done `confirmed` milestone + a signed
// contract are the enquiry→confirmed guard (AC-05.6).
export * from "./booking-milestones";
// Module N documents (documents.ts), D-132. The first slice: a signed contract on a booking milestone,
// reached only through a minted 15-minute access link (security.md); the storage key never leaves the API.
export * from "./documents";
// What the upload content checks decide a file is (content-kinds.ts), the document types and the kinds
// and caps each takes (document-types.ts), and a hotel's documents library (hotel-documents.ts); D-187.
export * from "./content-kinds";
export * from "./document-types";
export * from "./hotel-documents";
// Hotel information requests (D-188): the words the tables, the §7 machine and the contracts share.
export * from "./hotel-info-requests";
// Their staff routes' bodies, queries and answers (D-188 §3).
export * from "./hotel-info-request-contracts";
export * from "./hotel-info-request-views";
