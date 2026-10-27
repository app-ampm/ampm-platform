/**
 * Every note text of docs/permission-matrix.md §5 and §6 with its structured meaning. The cell parser
 * looks a note up here and stops the generator on a text that is missing, so a new note can never be
 * dropped silently: add it here with its conditions (src/conditions.ts) or change the document.
 * An entry with no conditions is a note that does not narrow the grant, and says why.
 */
import type { Condition, FieldGroup, Subject } from "../src/conditions.ts";
import type { ReportExclusion } from "../src/matrix.ts";
import type { Action } from "../src/roles.ts";

const subject = (...anyOf: Subject[]): Condition => ({ kind: "subject", anyOf });
const fields = (...only: FieldGroup[]): Condition => ({ kind: "fields", only });

/**
 * §5 staff cells: the record subsets, field groups and checks the document narrows grants to.
 *
 * @example
 * lookup(STAFF_NOTES, "check-in only"); // [{ kind: "check", check: "check_in" }]
 */
export const STAFF_NOTES: Readonly<Record<string, readonly Condition[]>> = {
  "finance entities": [subject("finance_entity")],
  hotels: [subject("hotel")],
  guests: [subject("guest")],
  vendors: [subject("vendor")],
  hotel: [subject("hotel")],
  vendor: [subject("vendor")],
  "hotel lines": [subject("hotel")],
  "vendor lines": [subject("vendor")],
  "hotel services": [subject("hotel")],
  "hotel-related": [subject("hotel")],
  "hotel threads": [subject("hotel")],
  "hotel conversations": [subject("hotel")],
  "guest threads": [subject("guest")],
  "guest conversations": [subject("guest")],
  "design threads": [subject("design")],
  // VC deals with vendor proposals only; it has no access to hotel proposals (§5.4).
  "proposal threads": [subject("vendor_proposal")],
  proposals: [subject("vendor_proposal")],
  "invoice threads": [subject("invoice")],
  "hotel proposals": [subject("hotel_proposal")],
  designs: [subject("design")],
  "designs, invitations": [subject("design", "invitation")],
  "budget lines, contracts, invoices": [subject("budget_line", "contract", "invoice")],
  "invoices, client contracts": [subject("invoice", "client_contract")],
  "transport vendor": [subject("transport_vendor")],
  "departures, lost and found": [subject("departures", "lost_and_found")],
  "final accounts": [subject("final_accounts")],
  "vendor completion": [subject("vendor_completion")],
  billing: [fields("billing")],
  status: [fields("status")],
  rights: [fields("rights")],
  "rights, showcase": [fields("rights", "showcase")],
  "theme, dress code": [fields("theme", "dress_code")],
  "logistics notes": [fields("logistics_notes")],
  "vendor cues": [fields("vendor_cues")],
  "mark delivered": [fields("delivered")],
  "with explicit grant": [{ kind: "explicit_grant" }],
  "check-in only": [{ kind: "check", check: "check_in" }],
  "break-glass": [{ kind: "check", check: "break_glass" }],
  "when the checklist is complete and final accounts are approved": [
    { kind: "check", check: "closure_ready" },
  ],
};

/**
 * §6 client, guest and demo cells. Scope is always the principal's own wedding or account.
 *
 * @example
 * lookup(OTHER_NOTES, "feedback"); // [{ kind: "fields", only: ["feedback"] }]
 */
export const OTHER_NOTES: Readonly<Record<string, readonly Condition[]>> = {
  // "Own" is the scope of every §6 grant (§6 preamble), so these words narrow nothing further.
  own: [],
  "own account": [],
  "own conversations": [],
  members: [],
  // Rights the two representatives share equally (Q5); P-9 is the staff side of the decision.
  "(either representative)": [],
  "(either representative; P-9 on-behalf with a note)": [],
  // Changes go through a client request, which is its own row: no update here.
  "changes through a request": [],
  feedback: [fields("feedback")],
  "attendance and dietary": [fields("attendance", "dietary")],
  summaries: [{ kind: "view", view: "summary" }],
  "approved summaries only (Q7)": [
    { kind: "view", view: "summary" },
    { kind: "check", check: "approved" },
  ],
  "status only": [{ kind: "view", view: "status_only" }],
  // The demo's own model of commercial fields. Q3 changed it to indicative prices (§0a, §3, P-7):
  // the later decision sets what this view shows; the cell still says "masked".
  masked: [{ kind: "view", view: "masked" }],
  sample: [{ kind: "check", check: "demo_record" }],
  demo: [{ kind: "check", check: "demo_record" }],
  "sample masked": [
    { kind: "check", check: "demo_record" },
    { kind: "view", view: "masked" },
  ],
  "routed to Sales": [{ kind: "check", check: "routed_to_sales" }],
  "invited functions only": [{ kind: "check", check: "invited" }],
  "members up to allowance": [{ kind: "check", check: "within_allowance" }],
  "upload when the project requires it": [{ kind: "check", check: "identity_required" }],
  "travel details when requested": [
    fields("travel_details"),
    { kind: "check", check: "travel_requested" },
  ],
  "documents shared to guests": [{ kind: "check", check: "shared_with_guests" }],
  "support request": [subject("support_request")],
};

/**
 * §6 prefixes before a colon ("own group: R members"), with what they add to every grant.
 *
 * @example
 * lookup(OTHER_PREFIXES, "own row"); // []
 */
export const OTHER_PREFIXES: Readonly<Record<string, readonly Condition[]>> = {
  own: [],
  "own group": [],
  "own row": [],
  "own allocation once confirmed": [{ kind: "check", check: "allocation_confirmed" }],
};

/**
 * Letterless §6 segments that are verbs: a grant of their own, or null when reading covers them.
 *
 * @example
 * lookup(OTHER_VERBS, "comment")?.actions; // ["create"]
 */
export const OTHER_VERBS: Readonly<
  Record<
    string,
    { readonly actions: readonly Action[]; readonly conditions: readonly Condition[] } | null
  >
> = {
  // The legend has no comment action: commenting creates a comment on the shared version.
  comment: { actions: ["create"], conditions: [subject("comment")] },
  // Files follow records (§1): downloading a shared document is reading it.
  download: null,
};

/**
 * Whole cells that grant nothing, in words.
 *
 * @example
 * NO_GRANT_CELLS.includes("request only"); // true
 */
export const NO_GRANT_CELLS: readonly string[] = [
  "—",
  // §5.6 and §5.15: the PM may ask; authorising is the Super Admin's (Q10, Q23).
  "request only",
  "— (not in the first release, Q4)",
  // Client finance and exports wait for AMPM's answer (Q4): nothing until then.
  "To confirm (Q4)",
  "To confirm (Q4); internal data never",
  "To confirm (Q4); never guest data",
];

/**
 * §5.16 "Excluded from the export" texts, each part between semicolons.
 *
 * @example
 * lookup(REPORT_EXCLUSIONS, "Bank details")?.kind; // "class"
 */
export const REPORT_EXCLUSIONS: Readonly<Record<string, ReportExclusion>> = {
  "Internal amounts unless FA or SA": {
    kind: "class",
    class: "RESTRICTED-FINANCE",
    unlessRoles: ["FA", "SA"],
  },
  // Margin totals of the final accounts are RESTRICTED-FINANCE (§4).
  "Margin unless FA or SA": {
    kind: "class",
    class: "RESTRICTED-FINANCE",
    unlessRoles: ["FA", "SA"],
  },
  "Bank details": { kind: "class", class: "RESTRICTED-BANK", unlessRoles: [] },
  "Sensitive guest fields": { kind: "class", class: "SENSITIVE-GUEST", unlessRoles: [] },
  "Identity documents": { kind: "class", class: "RESTRICTED-IDENTITY", unlessRoles: [] },
  "the hotel rooming list export carries names, dates and room category only and is audited": {
    kind: "variant",
    variant: "hotel_rooming_list",
    onlyFields: ["names", "dates", "room_category"],
    audited: true,
  },
};

/**
 * Cells that update or delete records their own read does not reach, as the document writes them
 * on purpose (POL-19). The generator stops on any other such cell: an edit wider than the read,
 * an assigned edit beside an own read or the reverse, or an edit with no read at all.
 *
 * @example
 * EDITS_BEYOND_READ.includes("U (a) mark delivered"); // true
 */
export const EDITS_BEYOND_READ: readonly string[] = [
  // §5.9 line 248 (PM, CD, VC, RG, HL): their own internal comments, written through C (a).
  "CR (a) UD (o)",
  // §5.6 line 208: function status; the function itself is read through its row (line 203).
  "U",
  "U (a)",
  // §5.8 line 238: HL marks a deliverable delivered on the assignment it reads (line 235).
  "U (a) mark delivered",
  // §5.15 line 311: each role completes its own item of the closure checklist.
  "U vendor completion",
  "U (a) departures, lost and found",
  "U final accounts",
  // §6 line 354: the representatives record the vendor decision on the options of line 353.
  "U (either representative)",
];

/**
 * Cells whose letters the document leaves ambiguous, with the reading adopted until AMPM confirms.
 * The generator stops on any other cell that edits wider than it reads (EDITS_BEYOND_READ).
 *
 * @example
 * lookup(READINGS, "CR (o) UD"); // "CR (o) UD (o)"
 */
export const READINGS: Readonly<Record<string, string>> = {
  // §5.9 "Comments, internal" (SM, HT, FA): "UD" after "CR (o)" would let them edit and delete every
  // internal comment while reading only their own; the narrower reading holds (POL-19).
  "CR (o) UD": "CR (o) UD (o)",
};
