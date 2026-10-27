/*
 * The RESTRICTED-NOTES part of the §4 golden table (docs/permission-matrix.md line 122, "Staff with
 * module access per §5"), written by hand from the document: the records it is tried on and, per
 * role, the ones whose §5 cell opens it (line in the comment). A conditioned read ("RU (a) theme,
 * dress code") names the columns or records it covers, so it opens no notes: the contexts in which
 * a role holds only such a read must close the class (src/visibility.golden.test.ts).
 */
import { A, type ClassGolden, on, ROWS } from "./class-contexts";

const PLAIN = {
  anywhere: {},
  unknown: on("hotels.nowhere"),
  hotelProfiles: on(ROWS.hotelProfiles, A), // notes row 169: SA RU, SM R, HT RU, PM R
  hotelContacts: on(ROWS.hotelContacts, A), // its table's notes (169); HL reads contacts only
  enquiries: on(ROWS.enquiries, A), // 183: SA CRU, SM R, HT CRU, PM CR (a); FA reads 182 only
  projects: on(ROWS.projects, A), // 194: SA RU, PM RU (a), FA R
  projectsUnassigned: on(ROWS.projects),
  vendorProfiles: on(ROWS.vendorProfiles, A), // 232: SA RU, PM R (a), VC RU
  vendorProfilesUnassigned: on(ROWS.vendorProfiles),
  vendorContacts: on(ROWS.vendorContacts, A), // its table's notes (232); HL reads contacts only
  guests: on(ROWS.guests, A), // 263: SA RU, PM R (a), RG CRU (a), HL R (a)
  guestsUnassigned: on(ROWS.guests),
  internalComments: on(ROWS.internalComments, A), // 248: CR (a) for PM, CD, VC, RG, HL
  ownInternalComments: on(ROWS.internalComments, { owned: true }), // 248: CR (o) SM, HT, FA
  incidents: on(ROWS.incidents, A), // 296: incidents are notes by default
};

// Records on which some role holds only a conditioned read.
const CONDITIONED = {
  // 203, functions' internal_notes (line 122): CD "RU (a) theme, dress code", HL "RU (a) logistics
  // notes"; SA CRUD, SM R, HT R (a), PM CRUD (a), VC R (a), RG R (a), FA R read the row plainly.
  functionsTheme: on(ROWS.functions, { assigned: true, fields: ["theme", "dress_code"] }),
  functionsLogistics: on(ROWS.functions, { assigned: true, fields: ["logistics_notes"] }),
  // 205: VC "RU (a) vendor cues"; SA, PM, CD R (a), HL CRU (a) plainly.
  runOfShowCues: on(ROWS.runOfShow, { assigned: true, fields: ["vendor_cues"] }),
  // 215: HT "RU hotel lines", VC "RU (a) vendor lines"; SA, PM, CD R (a), HL R (a), FA plainly.
  clientLinesHotel: on(ROWS.clientLines, { assigned: true, side: "hotel" }),
  clientLinesVendor: on(ROWS.clientLines, { assigned: true, side: "vendor" }),
};
const FUNCTIONS = ["functionsTheme", "functionsLogistics"];
const CLIENT_LINES = ["clientLinesHotel", "clientLinesVendor"];

/**
 * §4 line 122, RESTRICTED-NOTES, with every context it is tried in and the roles that open it.
 *
 * @example
 * NOTES_GOLDEN.opens.CD?.includes("functionsTheme"); // false: a conditioned read opens no notes
 */
export const NOTES_GOLDEN: ClassGolden = {
  cls: "RESTRICTED-NOTES",
  line: 122,
  contexts: { ...PLAIN, ...CONDITIONED },
  opens: {
    SA: [
      ...["hotelProfiles", "hotelContacts", "enquiries", "projects", "projectsUnassigned"],
      ...["vendorProfiles", "vendorProfilesUnassigned", "vendorContacts", "guests"],
      ...["guestsUnassigned", "internalComments", "ownInternalComments", "incidents"],
      ...Object.keys(CONDITIONED),
    ],
    SM: ["hotelProfiles", "hotelContacts", "enquiries", "ownInternalComments", ...FUNCTIONS],
    HT: ["hotelProfiles", "hotelContacts", "enquiries", "ownInternalComments", ...FUNCTIONS],
    PM: [
      ...["hotelProfiles", "hotelContacts", "enquiries", "projects", "vendorProfiles"],
      ...["vendorContacts", "guests", "internalComments", "incidents"],
      ...Object.keys(CONDITIONED),
    ],
    CD: ["internalComments", "incidents", "runOfShowCues", ...CLIENT_LINES],
    VC: [
      ...["vendorProfiles", "vendorProfilesUnassigned", "vendorContacts", "internalComments"],
      ...["incidents", ...FUNCTIONS],
    ],
    RG: ["guests", "internalComments", "incidents", ...FUNCTIONS, "runOfShowCues"],
    HL: ["guests", "internalComments", "incidents", "runOfShowCues", ...CLIENT_LINES],
    FA: ["projects", "projectsUnassigned", "ownInternalComments", ...FUNCTIONS, ...CLIENT_LINES],
  },
};
