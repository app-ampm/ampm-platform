/*
 * Golden table of §4's "Readable by" column for staff roles (docs/permission-matrix.md lines
 * 119-128), written by hand from the document: per class, the records it is tried on, and per role
 * the ones that open it, by §4 and by the §5 cell of the record's row (line in the comment). Every
 * other record must close it (src/visibility.golden.test.ts). RESTRICTED-NOTES is in
 * src/golden/classes-notes.ts, the records in src/golden/class-contexts.ts.
 */
import { STAFF_ROLE_CODES } from "../roles";
import type { ClassContext } from "../visibility";

import { A, type ClassGolden, EVERY_FACT, on, ROWS } from "./class-contexts";
import { NOTES_GOLDEN } from "./classes-notes";

const PUBLIC_CONTEXTS = {
  anywhere: {},
  assigned: A,
  bankDetails: on(ROWS.bankDetails),
  unknown: on("hotels.nowhere"),
  everyFact: EVERY_FACT,
};

// §4 lines 120-121: staff with module access per §5, so the row's cell in the context decides.
const MODULE_ACCESS = {
  contexts: {
    anywhere: {},
    bankDetails: on(ROWS.bankDetails),
    projectNotes: on(ROWS.projectNotes),
    projectNotesAssigned: on(ROWS.projectNotes, A),
    internalCost: on(ROWS.internalCost),
    internalCostHotel: on(ROWS.internalCost, { side: "hotel" }),
    internalCostVendorAssigned: on(ROWS.internalCost, { side: "vendor", assigned: true }),
    guestsAssigned: on(ROWS.guests, A),
    identityAtCheckIn: on(ROWS.identity, { assigned: true, checks: ["check_in"] }),
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
  internalCost: on(ROWS.internalCost), // 216: HT "RU hotel lines", VC "RU (a) vendor lines"
  internalCostHotel: on(ROWS.internalCost, { side: "hotel" }),
  internalCostVendorAssigned: on(ROWS.internalCost, { side: "vendor", assigned: true }),
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
  hotelContacts: on(ROWS.hotelContacts, { side: "hotel", assigned: true }), // 170: PM R, HL R (a)
  hotelContactsUnassigned: on(ROWS.hotelContacts, { side: "hotel" }),
  vendorContacts: on(ROWS.vendorContacts, { side: "vendor", assigned: true }), // 231: PM, HL R (a)
  vendorProfiles: on(ROWS.vendorProfiles, { side: "vendor", assigned: true }), // 230: CD, SM, FA R
  venues: on(ROWS.venues, A), // 195: PM CRU (a), HL RU (a); CD, VC, RG R (a)
  venuesHotelSide: on(ROWS.venues, { side: "hotel", assigned: true }), // 195: HT CRU
  venuesUnassigned: on(ROWS.venues),
  vehicles: on(ROWS.vehicles, A), // 278: drivers' phones; PM RU (a), HL CRUD (a), RG R (a)
  guests: on(ROWS.guests, A), // 261: no contact columns
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
  bankDetails: on(ROWS.bankDetails, { side: "vendor" }), // 233: SA R, FA RU; VC none (notes.ts)
  vendorProfiles: on(ROWS.vendorProfiles, { side: "vendor", assigned: true }), // 230: VC CRUD
  accountsBilling: on(ROWS.accounts, { fields: ["billing"] }), // §5.2 line 155: FA "RU billing"
} satisfies Record<string, ClassContext>;

const SENSITIVE_CONTEXTS = {
  anywhere: {},
  assigned: A,
  owned: { owned: true },
  guests: on(ROWS.guests, A), // 261
  guestsUnassigned: on(ROWS.guests),
  sensitive: on(ROWS.sensitive, A), // 262: SA R, PM R (a), RG RU (a), HL R (a)
  supportRequests: on(ROWS.support, A), // 268: dietary, accessibility and complaint requests
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
    documentsBreakGlass: on(ROWS.identity, { checks: ["break_glass"] }), // 264: SA R break-glass
    documentsExplicit: on(ROWS.identity, { assigned: true, explicitGrant: true }), // RG CRU (a)
    documentsCheckIn: on(ROWS.identity, { assigned: true, checks: ["check_in"] }), // HL R (a)
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
  NOTES_GOLDEN,
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
