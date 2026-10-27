/*
 * Golden table of §4's "Readable by" column for staff roles (docs/permission-matrix.md lines
 * 119-128), written by hand from the document: per class, the records it is tried on, and per role
 * the ones that open it, by §4 and by the §5 cell of the record's row (line in the comment). Every
 * other record must close it (src/visibility.golden.test.ts).
 */
import type { VisibilityClass } from "../classes";
import { STAFF_ROLE_CODES, type StaffRole } from "../roles";
import type { ClassContext } from "../visibility";

/**
 * One §4 class: the contexts it is tried in, by name, and per role the names of those that open
 * it; a role it does not list opens it in none.
 *
 * @example
 * const golden: ClassGolden = { cls: "SECRET", line: 128, contexts: { anywhere: {} }, opens: {} };
 */
export interface ClassGolden {
  readonly cls: VisibilityClass;
  /** The class's row in §4. */
  readonly line: number;
  readonly contexts: Readonly<Record<string, ClassContext>>;
  readonly opens: Readonly<Partial<Record<StaffRole, readonly string[]>>>;
}

const on = (resource: string, facts: ClassContext = {}): ClassContext => ({ ...facts, resource });
const A: ClassContext = { assigned: true };
const EVERY_FACT: ClassContext = {
  assigned: true,
  owned: true,
  explicitGrant: true,
  checks: ["check_in", "break_glass"],
};

// The rows the records are read through, as resources.ts names them (§5 line in the comment).
const HOTEL_PROFILES = "hotels.hotel_profiles_client_fields"; // 168
const HOTEL_CONTACTS = "hotels.hotel_contacts"; // 170
const ENQUIRIES = "consultancy.hotel_enquiries_client_fields"; // 182
const PROJECTS = "projects.wedding_projects"; // 193
const PROJECT_NOTES = "projects.project_internal_notes"; // 194
const VENUES = "projects.project_hotels_external_venues"; // 195
const INTERNAL_COST = "budget.budget_lines_internal_cost"; // 216
const VENDOR_PROFILES = "vendors.vendor_profiles_client_fields"; // 230
const VENDOR_CONTACTS = "vendors.vendor_contacts"; // 231
const BANK_DETAILS = "vendors.vendor_bank_details"; // 233, VC's cell as notes.ts reads it
const INTERNAL_COMMENTS = "creative.comments_internal"; // 248
const GUESTS = "guests.family_groups_guests_standard"; // 261
const SENSITIVE = "guests.guest_sensitive_fields"; // 262
const IDENTITY = "guests.identity_documents"; // 264
const SUPPORT = "guests.guest_support_requests"; // 268
const VEHICLES = "rooms.vehicles_transfers_passengers"; // 278
const INCIDENTS = "tasks.incidents"; // 296
const ACCOUNTS = "crm.accounts"; // §5.2 line 155

const PUBLIC_CONTEXTS = {
  anywhere: {},
  assigned: A,
  bankDetails: on(BANK_DETAILS),
  unknown: on("hotels.nowhere"),
  everyFact: EVERY_FACT,
};

// §4 lines 120-121: staff with module access per §5, so the row's cell in the context decides.
const MODULE_ACCESS = {
  contexts: {
    anywhere: {},
    bankDetails: on(BANK_DETAILS),
    projectNotes: on(PROJECT_NOTES),
    projectNotesAssigned: on(PROJECT_NOTES, A),
    internalCost: on(INTERNAL_COST),
    internalCostHotel: on(INTERNAL_COST, { side: "hotel" }),
    internalCostVendorAssigned: on(INTERNAL_COST, { side: "vendor", assigned: true }),
    guestsAssigned: on(GUESTS, A),
    identityAtCheckIn: on(IDENTITY, { assigned: true, checks: ["check_in"] }),
    unknown: on("hotels.nowhere"),
  },
  opens: {
    SA: [
      ...["anywhere", "bankDetails", "projectNotes", "projectNotesAssigned", "internalCost"],
      ...["internalCostHotel", "internalCostVendorAssigned", "guestsAssigned"],
    ],
    SM: ["anywhere"],
    HT: ["anywhere", "internalCostHotel"],
    PM: ["anywhere", "projectNotesAssigned", "internalCostVendorAssigned", "guestsAssigned"],
    CD: ["anywhere"],
    VC: ["anywhere", "internalCostVendorAssigned"],
    RG: ["anywhere", "guestsAssigned"],
    HL: ["anywhere", "guestsAssigned", "identityAtCheckIn"],
    FA: [
      ...["anywhere", "bankDetails", "projectNotes", "projectNotesAssigned", "internalCost"],
      ...["internalCostHotel", "internalCostVendorAssigned"],
    ],
  },
};

const NOTES: ClassGolden = {
  cls: "RESTRICTED-NOTES",
  line: 122,
  contexts: {
    anywhere: {},
    unknown: on("hotels.nowhere"),
    hotelProfiles: on(HOTEL_PROFILES, A), // notes row 169: SA RU, SM R, HT RU, PM R
    hotelContacts: on(HOTEL_CONTACTS, A), // its table's notes (169); HL reads contacts only
    enquiries: on(ENQUIRIES, A), // 183: SA CRU, SM R, HT CRU, PM CR (a); FA reads line 182 only
    projects: on(PROJECTS, A), // 194: SA RU, PM RU (a), FA R
    projectsUnassigned: on(PROJECTS),
    vendorProfiles: on(VENDOR_PROFILES, A), // 232: SA RU, PM R (a), VC RU
    vendorProfilesUnassigned: on(VENDOR_PROFILES),
    vendorContacts: on(VENDOR_CONTACTS, A), // its table's notes (232); HL reads contacts only
    guests: on(GUESTS, A), // 263: SA RU, PM R (a), RG CRU (a), HL R (a)
    guestsUnassigned: on(GUESTS),
    internalComments: on(INTERNAL_COMMENTS, A), // 248: CR (a) for PM, CD, VC, RG, HL
    ownInternalComments: on(INTERNAL_COMMENTS, { owned: true }), // 248: CR (o) for SM, HT, FA
    incidents: on(INCIDENTS, A), // 296: incidents are notes by default
  },
  opens: {
    SA: [
      ...["hotelProfiles", "hotelContacts", "enquiries", "projects", "projectsUnassigned"],
      ...["vendorProfiles", "vendorProfilesUnassigned", "vendorContacts", "guests"],
      ...["guestsUnassigned", "internalComments", "ownInternalComments", "incidents"],
    ],
    SM: ["hotelProfiles", "hotelContacts", "enquiries", "ownInternalComments"],
    HT: ["hotelProfiles", "hotelContacts", "enquiries", "ownInternalComments"],
    PM: [
      ...["hotelProfiles", "hotelContacts", "enquiries", "projects", "vendorProfiles"],
      ...["vendorContacts", "guests", "internalComments", "incidents"],
    ],
    CD: ["internalComments", "incidents"],
    VC: [
      ...["vendorProfiles", "vendorProfilesUnassigned", "vendorContacts", "internalComments"],
      "incidents",
    ],
    RG: ["guests", "internalComments", "incidents"],
    HL: ["guests", "internalComments", "incidents"],
    FA: ["projects", "projectsUnassigned", "ownInternalComments"],
  },
};

const SIDED = {
  anywhere: {},
  assigned: A,
  owned: { owned: true },
  hotelSide: { side: "hotel" },
  vendorSide: { side: "vendor" },
  assignedHotel: { assigned: true, side: "hotel" },
  assignedVendor: { assigned: true, side: "vendor" },
} satisfies Record<string, ClassContext>;

const FINANCE_CONTEXTS = {
  ...SIDED,
  internalCost: on(INTERNAL_COST), // 216: HT "RU hotel lines", VC "RU (a) vendor lines"
  internalCostHotel: on(INTERNAL_COST, { side: "hotel" }),
  internalCostVendorAssigned: on(INTERNAL_COST, { side: "vendor", assigned: true }),
};

const FINANCE: ClassGolden = {
  cls: "RESTRICTED-FINANCE",
  line: 123,
  contexts: FINANCE_CONTEXTS,
  opens: {
    SA: Object.keys(FINANCE_CONTEXTS),
    FA: Object.keys(FINANCE_CONTEXTS),
    PM: ["assigned", "assignedHotel", "assignedVendor", "internalCostVendorAssigned"],
    HT: ["hotelSide", "assignedHotel", "internalCostHotel"],
    VC: ["vendorSide", "assignedVendor", "internalCostVendorAssigned"],
  },
};

const CONTACT_CONTEXTS = {
  anywhere: {},
  assigned: A,
  hotelSide: { side: "hotel" },
  vendorSide: { side: "vendor" },
  hotelContacts: on(HOTEL_CONTACTS, { side: "hotel", assigned: true }), // 170: PM R, HL R (a)
  hotelContactsUnassigned: on(HOTEL_CONTACTS, { side: "hotel" }),
  vendorContacts: on(VENDOR_CONTACTS, { side: "vendor", assigned: true }), // 231: PM, HL R (a)
  vendorProfiles: on(VENDOR_PROFILES, { side: "vendor", assigned: true }), // 230: CD, SM, FA R
  venues: on(VENUES, A), // 195: PM CRU (a), HL RU (a); CD, VC, RG R (a)
  venuesHotelSide: on(VENUES, { side: "hotel", assigned: true }), // 195: HT CRU
  venuesUnassigned: on(VENUES),
  vehicles: on(VEHICLES, A), // 278: drivers' phones; PM RU (a), HL CRUD (a), RG R (a)
  guests: on(GUESTS, A), // 261: no contact columns
} satisfies Record<string, ClassContext>;

const CONTACT: ClassGolden = {
  cls: "RESTRICTED-CONTACT",
  line: 124,
  contexts: CONTACT_CONTEXTS,
  opens: {
    SA: Object.keys(CONTACT_CONTEXTS),
    HT: ["hotelSide", "hotelContacts", "hotelContactsUnassigned", "venuesHotelSide"],
    SM: ["hotelSide", "hotelContacts", "hotelContactsUnassigned"],
    VC: ["vendorSide", "vendorContacts", "vendorProfiles"],
    // §5.3 line 170 gives PM "R" on every hotel's contacts: hotels belong to no wedding.
    PM: [
      ...["hotelContacts", "hotelContactsUnassigned", "vendorContacts", "vendorProfiles"],
      ...["venues", "venuesHotelSide", "vehicles"],
    ],
    // §5.8 line 231 gives HL "R (a)" on vendor contacts, though §4 line 124 does not list vendors.
    HL: [
      ...["hotelContacts", "vendorContacts", "vendorProfiles", "venues", "venuesHotelSide"],
      "vehicles",
    ],
  },
};

const BANK_CONTEXTS = {
  anywhere: {},
  assigned: A,
  vendorSide: { side: "vendor" },
  assignedVendor: { assigned: true, side: "vendor" },
  bankDetails: on(BANK_DETAILS, { side: "vendor" }), // 233: SA R, FA RU; VC none (notes.ts)
  vendorProfiles: on(VENDOR_PROFILES, { side: "vendor", assigned: true }), // 230: VC CRUD
  accountsBilling: on(ACCOUNTS, { fields: ["billing"] }), // §5.2 line 155: FA "RU billing"
} satisfies Record<string, ClassContext>;

const SENSITIVE_CONTEXTS = {
  anywhere: {},
  assigned: A,
  owned: { owned: true },
  guests: on(GUESTS, A), // 261
  guestsUnassigned: on(GUESTS),
  sensitive: on(SENSITIVE, A), // 262: SA R, PM R (a), RG RU (a), HL R (a)
  supportRequests: on(SUPPORT, A), // 268: dietary, accessibility and complaint requests
} satisfies Record<string, ClassContext>;
const GUEST_TEAMS = ["assigned", "guests", "sensitive", "supportRequests"];

const IDENTITY_GOLDEN: ClassGolden = {
  cls: "RESTRICTED-IDENTITY",
  line: 127,
  contexts: {
    anywhere: {},
    assigned: A,
    explicitAssigned: { assigned: true, explicitGrant: true },
    explicitUnassigned: { explicitGrant: true },
    checkInAssigned: { assigned: true, checks: ["check_in"] },
    checkInUnassigned: { checks: ["check_in"] },
    breakGlass: { checks: ["break_glass"] },
    everyFact: EVERY_FACT,
    documentsBreakGlass: on(IDENTITY, { checks: ["break_glass"] }), // 264: SA R break-glass
    documentsExplicit: on(IDENTITY, { assigned: true, explicitGrant: true }), // RG CRU (a)
    documentsCheckIn: on(IDENTITY, { assigned: true, checks: ["check_in"] }), // HL R (a)
  },
  opens: {
    SA: ["breakGlass", "everyFact", "documentsBreakGlass"],
    RG: ["explicitAssigned", "everyFact", "documentsExplicit"],
    HL: ["checkInAssigned", "everyFact", "documentsCheckIn"],
  },
};

/**
 * Every class of §4 with its golden contexts, in the document's order.
 *
 * @example
 * CLASS_GOLDEN.find((golden) => golden.cls === "RESTRICTED-BANK")?.opens.VC; // undefined
 */
export const CLASS_GOLDEN: readonly ClassGolden[] = [
  {
    cls: "PUBLIC",
    line: 119,
    contexts: PUBLIC_CONTEXTS,
    opens: Object.fromEntries(STAFF_ROLE_CODES.map((role) => [role, Object.keys(PUBLIC_CONTEXTS)])),
  },
  { cls: "CLIENT", line: 120, ...MODULE_ACCESS },
  { cls: "INTERNAL", line: 121, ...MODULE_ACCESS },
  NOTES,
  FINANCE,
  CONTACT,
  {
    cls: "RESTRICTED-BANK",
    line: 125,
    contexts: BANK_CONTEXTS,
    opens: { SA: Object.keys(BANK_CONTEXTS), FA: Object.keys(BANK_CONTEXTS) },
  },
  {
    cls: "SENSITIVE-GUEST",
    line: 126,
    contexts: SENSITIVE_CONTEXTS,
    opens: {
      SA: Object.keys(SENSITIVE_CONTEXTS),
      PM: GUEST_TEAMS,
      RG: GUEST_TEAMS,
      HL: GUEST_TEAMS,
    },
  },
  IDENTITY_GOLDEN,
  // §4 line 128: SYS only, never serialised.
  { cls: "SECRET", line: 128, contexts: { ...PUBLIC_CONTEXTS, ...SIDED }, opens: {} },
];
