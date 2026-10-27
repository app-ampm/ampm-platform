/**
 * How the matrix's rows become `module.resource` identifiers (permission-matrix §10). Each §5
 * subsection is a module; a row label maps to a resource name here or, until it is curated, to a
 * provisional slug of the label. Curate a row when its feature is built; the generated suite keeps
 * every row either way.
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
