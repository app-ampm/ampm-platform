import type { Action } from "./roles";
import type { ClassAction, VerbAction } from "./keys";

/**
 * How the matrix's rows become `module.resource` identifiers (permission-matrix §10). Each §5
 * subsection is a module; a row label maps to a resource name here or, until it is curated, to a
 * provisional slug of the label. Curate a row when its feature is built; the generated suite keeps
 * every row either way. Node runs the generator on this file with type stripping: type imports only.
 *
 * A key as §10 spells it resolves to its row through DOCUMENT_RESOURCES (document-keys.ts, the §10
 * resource names of the row's own module), OUTSIDE_KEYS (a row named from another module) or a
 * KEY_ALIASES row: `hotels.contacts.read` (§10 line 539) decides on "Hotel contacts". A new §10 key
 * that none of them covers fails keys.golden.test.ts and document-keys.test.ts.
 *
 * @example
 * MODULES["5.10"]; // "guests"
 */
export const MODULES: Record<string, string> = {
  "5.1": "admin",
  "5.2": "crm",
  "5.3": "hotels",
  "5.4": "consultancy",
  "5.5": "projects",
  "5.6": "functions",
  "5.7": "budget",
  "5.8": "vendors",
  "5.9": "creative",
  "5.10": "guests",
  "5.11": "rooms",
  "5.12": "menus",
  "5.13": "tasks",
  "5.14": "documents",
  "5.15": "closure",
  "5.16": "reports",
  "6": "client",
};

/**
 * Curated resource names by section and row label; any other row keeps the slug of its label.
 *
 * @example
 * RESOURCES["5.16"]?.["Internal cost and margin variance"]; // "budget_internal"
 */
export const RESOURCES: Record<string, Record<string, string>> = {
  "5.1": {
    "Staff users and global roles": "staff_users",
    "Client user logins (invite, reset, disable)": "client_logins",
    "Roles and permissions": "roles",
    "Configurations (thresholds, labels, templates, escalation rules)": "configurations",
    "Audit log": "audit_log",
    "Import jobs": "import_jobs",
    "Notifications log": "notifications",
  },
  "5.2": {
    "Leads and lead activities": "leads",
    "Client accounts and contacts": "accounts",
    "Plans and plan modules": "plans",
    Subscriptions: "subscriptions",
    "Service agreements": "service_agreements",
    "Payment milestones": "payment_milestones",
    "Payments inbound from clients": "payments_inbound",
    "Payments outbound to vendors and hotels": "payments_outbound",
  },
  // Module D (consultancy) feature 10.1 curates the two enquiry rows; site_visits, proposals and
  // booking_milestones stay provisional until features 10.3–10.5 build them.
  "5.4": {
    "Hotel enquiries, client fields": "enquiries",
    "Enquiry internal notes and internal-only events": "enquiry_notes",
  },
  // §10 names this report's export key `reports.budget_internal.export`.
  "5.16": {
    "Internal cost and margin variance": "budget_internal",
  },
};

/**
 * A §5 row that §10 also reaches through another key: `<module>.<resource>.<action>` means `as`.
 *
 * @example
 * const alias: KeyAlias = { label: "Artist bookings", action: "read_internal_cost", as: "read" };
 */
export interface KeyAlias {
  /** The row label whose resource the alias key names (the parent row, or the row itself). */
  readonly label: string;
  readonly action: ClassAction | VerbAction;
  /** The action of this row the alias stands for. */
  readonly as: Action;
}

/**
 * §10's class-specific reads and decisions, by section and row label. §5 holds a visibility class of
 * a resource in a row of its own ("Budget lines, internal cost"); `read_internal_cost` on the parent
 * row ("Budget lines, client-facing amounts") reads it. The generator stops when a label is missing.
 *
 * @example
 * KEY_ALIASES["5.7"]?.["Budget lines, internal cost"]?.action; // "read_internal_cost"
 */
export const KEY_ALIASES: Record<string, Record<string, KeyAlias>> = {
  "5.3": {
    "Hotel internal rating and notes": {
      label: "Hotel profiles, client fields",
      action: "read_internal_notes",
      as: "read",
    },
    "Hotel contacts": {
      label: "Hotel profiles, client fields",
      action: "read_contacts",
      as: "read",
    },
  },
  "5.4": {
    "Enquiry internal notes and internal-only events": {
      label: "Hotel enquiries, client fields",
      action: "read_internal_notes",
      as: "read",
    },
    "Hotel proposals, internal amounts": {
      label: "Hotel proposals, client amounts",
      action: "read_internal_amount",
      as: "read",
    },
  },
  "5.5": {
    "Project internal notes": {
      label: "Wedding projects (create, edit, status)",
      action: "read_internal_notes",
      as: "read",
    },
  },
  "5.6": {
    "Readiness exceptions (Q10: Eva's authorised personnel only)": {
      label: "Readiness exceptions (Q10: Eva's authorised personnel only)",
      action: "authorise_exception",
      as: "approve",
    },
  },
  "5.7": {
    "Budget lines, internal cost": {
      label: "Budget lines, client-facing amounts",
      action: "read_internal_cost",
      as: "read",
    },
  },
  "5.8": {
    "Vendor contacts": {
      label: "Vendor profiles, client fields",
      action: "read_contacts",
      as: "read",
    },
    "Vendor internal rating and notes": {
      label: "Vendor profiles, client fields",
      action: "read_internal_notes",
      as: "read",
    },
    "Vendor proposals, internal cost": {
      label: "Vendor proposals, client amounts",
      action: "read_internal_cost",
      as: "read",
    },
    "Artist fee, internal": { label: "Artist bookings", action: "read_internal_cost", as: "read" },
  },
  "5.9": {
    "Approval decisions, on the client's behalf with evidence": {
      label: "Approval decisions, on the client's behalf with evidence",
      action: "create_on_behalf",
      as: "approve",
    },
  },
  "5.10": {
    "Guest sensitive fields (allergies, accessibility)": {
      label: "Family groups and guests, standard fields",
      action: "read_sensitive",
      as: "read",
    },
    "Guest internal notes": {
      label: "Family groups and guests, standard fields",
      action: "read_internal_notes",
      as: "read",
    },
    "Identity documents": {
      label: "Family groups and guests, standard fields",
      action: "read_identity",
      as: "read",
    },
  },
  "5.11": {
    "Room blocks, internal rate": {
      label: "Room blocks, client fields",
      action: "read_internal_cost",
      as: "read",
    },
  },
};

/**
 * A §10 example key that names its §5 row from outside the row's subsection, or with no action.
 *
 * @example
 * const quotes: OutsideKey = { section: "5.7", label: "Vendor quotes", as: "read" };
 */
export interface OutsideKey {
  readonly section: string;
  readonly label: string;
  /** The action of that row the key stands for. */
  readonly as: Action;
}

/**
 * §10 keys whose module is not their row's subsection, by the key without its scope suffix.
 * Curating resource names (RESOURCES) cannot reach them, since a key's module picks the rows it
 * is looked up in. The generator stops when a label is missing.
 *
 * @example
 * OUTSIDE_KEYS["projects.close"]?.section; // "5.15"
 */
export const OUTSIDE_KEYS: Record<string, OutsideKey> = {
  // §10 line 545: raw vendor quotes are the §5.7 (budget) row of line 218.
  "vendors.quotes.read": { section: "5.7", label: "Vendor quotes", as: "read" },
  // §10 line 546: recording a client decision with evidence is the §5.9 (creative) row of line 252.
  "approvals.decisions.create_on_behalf": {
    section: "5.9",
    label: "Approval decisions, on the client's behalf with evidence",
    as: "approve",
  },
  // §10 line 551: closing a project is the §5.15 (closure) decision of line 312.
  "projects.close": { section: "5.15", label: "Close the project", as: "approve" },
};

/**
 * The provisional resource name of a row label.
 *
 * @example
 * slugify("Budget lines, internal cost"); // "budget_lines_internal_cost"
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => !["and", "the", "of", "to", "from", "with", "a", "an", "per"].includes(word))
    .slice(0, 4)
    .join("_");
}
