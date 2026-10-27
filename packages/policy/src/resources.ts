import type { Action } from "./roles";
import type { ClassAction, VerbAction } from "./keys";

/**
 * How the matrix's rows become `module.resource` identifiers (permission-matrix §10). Each §5
 * subsection is a module; a row label maps to a resource name here or, until it is curated, to a
 * provisional slug of the label. Curate a row when its feature is built; the generated suite keeps
 * every row either way. Node runs the generator on this file with type stripping: type imports only.
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
