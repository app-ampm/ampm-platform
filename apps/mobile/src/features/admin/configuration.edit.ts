import { CONFIG_REGISTRY, isConfigKey, serviceKey } from "@ampm/core";

import { CONFIG_KEY_WITH_OWN_SCREEN, prettifyIdentifier } from "./configuration.format";

/*
 * The editor model for the configuration inventory (admin console): which keys a Super Admin can edit,
 * the fields each one shows, and the conversion between a configuration value and the form's draft.
 * Pure — no React, no fetching. The assembled value is validated against the key's own `@ampm/core`
 * schema (the very schema the API enforces on the write), so the client and the server agree on what is
 * valid and no bound is duplicated. A registry key with no descriptor here stays read-only (it still
 * appears in the inventory) until an editor is added, so the screen never offers to edit a shape it
 * cannot build a form for.
 */

/** How one field of a configuration value is edited. */
export type ConfigEditFieldKind = "int" | "boolean" | "enumSet" | "flagMap";

/** One editable field of a configuration value. */
export interface ConfigEditField {
  /** The value property this field sets; for a flag map, the value is the record itself. */
  readonly path: string;
  readonly label: string;
  readonly kind: ConfigEditFieldKind;
  /** For `int`: the smallest value the schema allows — used only for a friendly field message. */
  readonly min?: number;
  /** For `enumSet`: the options to choose from. */
  readonly options?: readonly string[];
  readonly help?: string;
}

/** One named switch in a feature-flag map, as the editor renders and reorders it. */
export interface ConfigFlagRow {
  readonly name: string;
  readonly enabled: boolean;
}

/** A single field's draft value; the field's kind decides which member is in use. */
export type ConfigDraftValue = string | boolean | readonly string[] | readonly ConfigFlagRow[];

/** The whole form draft, keyed by field path. */
export type ConfigDraft = Record<string, ConfigDraftValue>;

/** The outcome of validating a draft: the assembled value when valid, else the messages to show. */
export interface ConfigValidation {
  /** The value to send; absent when the draft has errors. */
  readonly value?: unknown;
  readonly fieldErrors: Readonly<Record<string, string>>;
  /** A whole-form message (a flag map's names), shown above the fields. */
  readonly formError?: string;
}

const FLAG_MAP_PATH = "flags";

const CONFIG_EDIT_FIELDS: Record<string, readonly ConfigEditField[]> = {
  "session.idle_timeouts": [
    { path: "staffMinutes", label: "Staff minutes", kind: "int", min: 1 },
    { path: "clientMinutes", label: "Client minutes", kind: "int", min: 1 },
    { path: "demoMinutes", label: "Demo minutes", kind: "int", min: 1 },
  ],
  "notification.default_channels": [
    { path: "inApp", label: "In-app", kind: "boolean" },
    { path: "email", label: "Email", kind: "boolean" },
    { path: "sms", label: "SMS", kind: "boolean" },
    { path: "whatsapp", label: "WhatsApp", kind: "boolean" },
    { path: "push", label: "Push", kind: "boolean" },
  ],
  "feature.flags": [
    {
      path: FLAG_MAP_PATH,
      label: "Feature flags",
      kind: "flagMap",
      help: "A named switch; one that is absent is off.",
    },
  ],
  "subscription.policy": [
    { path: "expiryNoticeDays", label: "Expiry notice days", kind: "int", min: 0 },
  ],
  "hotel.verification_policy": [{ path: "maxAgeDays", label: "Max age days", kind: "int", min: 1 }],
  "consultancy.chargeable_services": [
    {
      path: "chargeableServiceKeys",
      label: "Chargeable services",
      kind: "enumSet",
      options: serviceKey.options,
    },
  ],
  "consultancy.milestone_amounts_visible": [
    { path: "milestoneAmountsVisible", label: "Client sees milestone amounts", kind: "boolean" },
  ],
};

/** Whether a configuration key has an editor (so a Super Admin may edit it from the inventory). */
export function isEditableConfigKey(key: string): boolean {
  return key !== CONFIG_KEY_WITH_OWN_SCREEN && Object.hasOwn(CONFIG_EDIT_FIELDS, key);
}

/** The fields the editor shows for a key (empty for a key with no editor). */
export function configEditFields(key: string): readonly ConfigEditField[] {
  return CONFIG_EDIT_FIELDS[key] ?? [];
}

/** A human label for an enum option (`site_visit` → "Site visit"). */
export function configOptionLabel(option: string): string {
  return prettifyIdentifier(option);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function draftFieldFromValue(
  field: ConfigEditField,
  obj: Record<string, unknown>,
): ConfigDraftValue {
  if (field.kind === "int") {
    const raw = obj[field.path];
    return typeof raw === "number" ? String(raw) : "";
  }
  if (field.kind === "boolean") return obj[field.path] === true;
  if (field.kind === "enumSet") {
    const raw = obj[field.path];
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
  }
  // A flag map's value is the record of name → boolean itself, so it reads from the whole value.
  return Object.entries(obj)
    .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    .map(([name, enabled]) => ({ name, enabled }));
}

/** The form draft that mirrors a key's current value. */
export function configDraftFromValue(key: string, value: unknown): ConfigDraft {
  const obj = asRecord(value);
  const draft: Record<string, ConfigDraftValue> = {};
  for (const field of configEditFields(key)) {
    draft[field.path] = draftFieldFromValue(field, obj);
  }
  return draft;
}

const INT_PATTERN = /^-?\d+$/;

function intFromDraft(
  field: ConfigEditField,
  raw: ConfigDraftValue,
): { value?: number; error?: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!INT_PATTERN.test(text)) return { error: "Enter a whole number" };
  const parsed = Number.parseInt(text, 10);
  if (field.min !== undefined && parsed < field.min) {
    return { error: field.min <= 0 ? "Cannot be negative" : `Must be at least ${field.min}` };
  }
  return { value: parsed };
}

function flagRecordFromDraft(raw: ConfigDraftValue): {
  value?: Record<string, boolean>;
  error?: string;
} {
  const rows = Array.isArray(raw)
    ? raw.filter((item): item is ConfigFlagRow => typeof item === "object" && item !== null)
    : [];
  const record: Record<string, boolean> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (name.length === 0) return { error: "Give every flag a name" };
    if (Object.hasOwn(record, name)) return { error: "Flag names must be unique" };
    record[name] = row.enabled;
  }
  return { value: record };
}

/**
 * Validate a draft and, when it is sound, assemble the value to send. Integer fields and flag names are
 * checked here for friendly messages; the assembled value is then parsed by the key's own schema, which
 * is the authority on every bound (an editor check that ever drifts from it is caught by this re-parse).
 */
export function validateConfigDraft(key: string, draft: ConfigDraft): ConfigValidation {
  const fieldErrors: Record<string, string> = {};
  const assembled: Record<string, unknown> = {};
  let flagRecord: Record<string, boolean> | undefined;
  let formError: string | undefined;
  for (const field of configEditFields(key)) {
    const raw = draft[field.path] ?? "";
    if (field.kind === "int") {
      const result = intFromDraft(field, raw);
      if (result.error) fieldErrors[field.path] = result.error;
      else assembled[field.path] = result.value;
    } else if (field.kind === "boolean") {
      assembled[field.path] = raw === true;
    } else if (field.kind === "enumSet") {
      assembled[field.path] = Array.isArray(raw) ? [...raw] : [];
    } else {
      const result = flagRecordFromDraft(raw);
      if (result.error) formError = result.error;
      else flagRecord = result.value;
    }
  }
  if (Object.keys(fieldErrors).length > 0 || formError !== undefined) {
    return { fieldErrors, formError };
  }
  const candidate: unknown = flagRecord ?? assembled;
  const schema = isConfigKey(key) ? CONFIG_REGISTRY[key].schema : undefined;
  const parsed = schema ? schema.safeParse(candidate) : { success: true as const, data: candidate };
  if (!parsed.success) {
    return { fieldErrors, formError: "That value isn't valid for this setting" };
  }
  return { value: parsed.data, fieldErrors };
}
