import { CONFIG_REGISTRY, isConfigKey } from "@ampm/core";

import { CONFIG_EDIT_FIELDS, type ConfigEditField } from "./configuration.fields";
import { CONFIG_KEY_WITH_OWN_SCREEN, prettifyIdentifier } from "./configuration.format";

export type { ConfigEditField, ConfigEditFieldKind } from "./configuration.fields";

/*
 * The editor model for the configuration inventory (admin console): which keys a Super Admin can edit
 * (the fields in configuration.fields.ts), and the conversion between a configuration value and the
 * form's draft. Pure — no React, no fetching. The assembled value is validated against the key's own
 * `@ampm/core` schema (the very schema the API enforces on the write), so the client and the server agree
 * on what is valid; the editor's own checks only word a field's message. A registry key with no fields
 * stays read-only (it still appears in the inventory) until an editor is added, so the screen never
 * offers to edit a shape it cannot build a form for.
 */

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

/** Whether a configuration key has an editor (so a Super Admin may edit it from the inventory). */
export function isEditableConfigKey(key: string): boolean {
  return key !== CONFIG_KEY_WITH_OWN_SCREEN && Object.hasOwn(CONFIG_EDIT_FIELDS, key);
}

/** The fields the editor shows for a key (empty for a key with no editor). */
export function configEditFields(key: string): readonly ConfigEditField[] {
  return CONFIG_EDIT_FIELDS[key] ?? [];
}

/** A human label for an option (`site_visit` → "Site visit", `test_only` → "Test only"). */
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
  const raw = obj[field.path];
  if (field.kind === "int") return typeof raw === "number" ? String(raw) : "";
  if (field.kind === "boolean") return raw === true;
  if (field.kind === "choice" || field.kind === "text") return typeof raw === "string" ? raw : "";
  if (field.kind === "enumSet") {
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

/** One field's assembled value, or the message that stops the save. */
interface FieldOutcome {
  readonly value?: unknown;
  readonly error?: string;
}

function intFromDraft(field: ConfigEditField, raw: ConfigDraftValue): FieldOutcome {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!INT_PATTERN.test(text)) return { error: "Enter a whole number" };
  const parsed = Number.parseInt(text, 10);
  if (field.min !== undefined && parsed < field.min) {
    return { error: field.min <= 0 ? "Cannot be negative" : `Must be at least ${field.min}` };
  }
  if (field.max !== undefined && parsed > field.max)
    return { error: `Must be at most ${field.max}` };
  return { value: parsed };
}

function choiceFromDraft(field: ConfigEditField, raw: ConfigDraftValue): FieldOutcome {
  return typeof raw === "string" && (field.options ?? []).includes(raw)
    ? { value: raw }
    : { error: "Choose one of the options" };
}

/** A text field's value: trimmed, a blank as none (null), held to its length. */
function textFromDraft(field: ConfigEditField, raw: ConfigDraftValue): FieldOutcome {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return { value: null };
  if (field.maxLength !== undefined && text.length > field.maxLength) {
    return { error: `Keep it to ${field.maxLength} characters at most` };
  }
  return { value: text };
}

function flagRecordFromDraft(raw: ConfigDraftValue): FieldOutcome {
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

/** One field's outcome by its kind (a flag map's is the whole value). */
function fieldFromDraft(field: ConfigEditField, raw: ConfigDraftValue): FieldOutcome {
  switch (field.kind) {
    case "int":
      return intFromDraft(field, raw);
    case "boolean":
      return { value: raw === true };
    case "enumSet":
      return { value: Array.isArray(raw) ? [...raw] : [] };
    case "choice":
      return choiceFromDraft(field, raw);
    case "text":
      return textFromDraft(field, raw);
    case "flagMap":
      return flagRecordFromDraft(raw);
  }
}

/**
 * The key's schema on the assembled value, its refusals placed under the text fields that word them (a
 * malformed reply-to), any other as the whole form's.
 */
function parsedBySchema(
  key: string,
  candidate: unknown,
  fields: readonly ConfigEditField[],
): ConfigValidation {
  const schema = isConfigKey(key) ? CONFIG_REGISTRY[key].schema : undefined;
  const parsed = schema ? schema.safeParse(candidate) : { success: true as const, data: candidate };
  if (parsed.success) return { value: parsed.data, fieldErrors: {} };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = fields.find((candidateField) => candidateField.path === issue.path[0]);
    if (field?.invalid) fieldErrors[field.path] ??= field.invalid;
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { fieldErrors, formError: "That value isn't valid for this setting" };
}

/**
 * Validate a draft and, when it is sound, assemble the value to send. Each field's own check words its
 * message (a whole number and its bounds, a choice, a text's length, the flag names); the assembled value
 * is then parsed by the key's own schema, which is the authority on every bound (an editor check that
 * ever drifts from it is caught by this re-parse).
 */
export function validateConfigDraft(key: string, draft: ConfigDraft): ConfigValidation {
  const fields = configEditFields(key);
  const fieldErrors: Record<string, string> = {};
  const assembled: Record<string, unknown> = {};
  let flagRecord: unknown;
  let formError: string | undefined;
  for (const field of fields) {
    const outcome = fieldFromDraft(field, draft[field.path] ?? "");
    if (field.kind === "flagMap") {
      if (outcome.error) formError = outcome.error;
      else flagRecord = outcome.value;
    } else if (outcome.error) {
      fieldErrors[field.path] = outcome.error;
    } else {
      assembled[field.path] = outcome.value;
    }
  }
  if (Object.keys(fieldErrors).length > 0 || formError !== undefined) {
    return { fieldErrors, formError };
  }
  return parsedBySchema(key, flagRecord ?? assembled, fields);
}
