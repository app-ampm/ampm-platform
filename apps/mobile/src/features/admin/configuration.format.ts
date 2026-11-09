import type { ConfigView } from "@ampm/core";

/*
 * Presentation helpers for the configuration inventory (admin console): a human label, area and
 * description for each known key, and a generic renderer that turns a configuration value into
 * readable label/value fields. No fetching. A key the registry adds without a meta entry still
 * renders — its key becomes the label and its value goes through the same generic fields — so the
 * screen never hides configuration it does not yet recognise.
 */

/** One configuration key and its value, as the screen and the detail sheet pass it around. */
export interface ConfigEntry {
  readonly key: string;
  readonly value: unknown;
}

/** One label/value field in a configuration's detail. */
export interface ConfigField {
  readonly label: string;
  readonly value: string;
}

interface ConfigMeta {
  readonly label: string;
  readonly area: string;
  readonly description: string;
}

/**
 * The key whose rich viewer lives on its own screen (notification templates, TW-94), so the generic
 * inventory leaves it out rather than dumping its nested message bodies.
 */
export const CONFIG_KEY_WITH_OWN_SCREEN = "notification.templates";

const UNKNOWN_AREA = "Other";

const CONFIG_META: Record<string, ConfigMeta> = {
  "session.idle_timeouts": {
    label: "Session idle timeouts",
    area: "Access",
    description:
      "How long a signed-in session stays active without activity, in minutes, by audience (staff, client, demo).",
  },
  "notification.default_channels": {
    label: "Default notification channels",
    area: "Notifications",
    description: "Which channels are on by default before a person sets their own preference.",
  },
  "feature.flags": {
    label: "Feature flags",
    area: "Platform",
    description: "Named feature switches; a name that is absent is off.",
  },
  "subscription.policy": {
    label: "Subscription policy",
    area: "Subscriptions",
    description: "Lifecycle thresholds, including the notice window before a term ends.",
  },
  "hotel.verification_policy": {
    label: "Hotel verification policy",
    area: "Hotels",
    description: "How many days a hotel verification stays fresh before it is stale.",
  },
  "consultancy.chargeable_services": {
    label: "Chargeable consultancy services",
    area: "Consultancy",
    description: "Which hotel-assistance services need an active service agreement to proceed.",
  },
  "consultancy.milestone_amounts_visible": {
    label: "Client sees milestone amounts",
    area: "Consultancy",
    description: "Whether booking-milestone amounts are shown to the client.",
  },
};

/** Turn a dotted or camelCase identifier into a spaced, capitalised label (`staffMinutes` → "Staff minutes"). */
export function prettifyIdentifier(raw: string): string {
  const spaced = raw
    .replace(/[._]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (spaced.length === 0) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function configLabel(key: string): string {
  return CONFIG_META[key]?.label ?? prettifyIdentifier(key);
}

export function configArea(key: string): string {
  return CONFIG_META[key]?.area ?? UNKNOWN_AREA;
}

export function configDescription(key: string): string {
  return CONFIG_META[key]?.description ?? "";
}

/** A single configuration value rendered to one readable string (booleans as On/Off, arrays joined). */
export function formatConfigScalar(value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length > 0 ? value : "—";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(formatConfigScalar).join(", ") : "—";
  }
  if (value && typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>);
    return inner.length > 0
      ? inner.map(([k, v]) => `${prettifyIdentifier(k)}: ${formatConfigScalar(v)}`).join(" · ")
      : "—";
  }
  return "—";
}

/** The label/value fields for a configuration value: one per object field, or a single "Value" row. */
export function configFields(value: unknown): ConfigField[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      label: prettifyIdentifier(k),
      value: formatConfigScalar(v),
    }));
  }
  return [{ label: "Value", value: formatConfigScalar(value) }];
}

/** A compact one-line summary of a configuration value for the table row; "Not set" when it is empty. */
export function configSummary(value: unknown): string {
  const fields = configFields(value);
  if (fields.length === 0) return "Not set";
  return fields.map((field) => `${field.label}: ${field.value}`).join(" · ");
}

/**
 * The inventory as sorted rows: the key with its own screen removed, then ordered by area and label so
 * related settings sit together. Takes the raw `{ key, value }` views the hook returns.
 */
export function toConfigEntries(views: ConfigView[]): ConfigEntry[] {
  return views
    .filter((view) => view.key !== CONFIG_KEY_WITH_OWN_SCREEN)
    .map((view) => ({ key: view.key, value: view.value }))
    .sort((a, b) => {
      const byArea = configArea(a.key).localeCompare(configArea(b.key));
      return byArea !== 0 ? byArea : configLabel(a.key).localeCompare(configLabel(b.key));
    });
}

/** A screen-reader summary of one configuration row: its label, area and value. */
export function configRowSummary(entry: ConfigEntry): string {
  return `${configLabel(entry.key)}, ${configArea(entry.key)}. ${configSummary(entry.value)}`;
}
