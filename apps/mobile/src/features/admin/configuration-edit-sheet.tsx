import { useEffect, useState } from "react";
import { View } from "react-native";

import { useUpdateConfiguration } from "@ampm/api-client";
import { Button, Callout, FilterChip, Input, Sheet, Stack, Text, Toggle, useToast } from "@ampm/ui";

import { configDescription, configLabel, type ConfigEntry } from "./configuration.format";
import {
  configDraftFromValue,
  configEditFields,
  configOptionLabel,
  validateConfigDraft,
  type ConfigDraft,
  type ConfigDraftValue,
  type ConfigEditField,
  type ConfigFlagRow,
  type ConfigValidation,
} from "./configuration.edit";

type SetField = (path: string, value: ConfigDraftValue) => void;

function stringsOf(value: ConfigDraftValue | undefined): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function flagRowsOf(value: ConfigDraftValue | undefined): readonly ConfigFlagRow[] {
  return Array.isArray(value)
    ? value.filter((item): item is ConfigFlagRow => typeof item === "object" && item !== null)
    : [];
}

/** The edit form's state, validation and submission; kept out of the view so each stays small. */
function useConfigEditForm(entry: ConfigEntry | null, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateConfiguration();
  const [draft, setDraft] = useState<ConfigDraft>({});
  const [validation, setValidation] = useState<ConfigValidation>({ fieldErrors: {} });
  // Re-seed from the current value each time the sheet opens on a key.
  useEffect(() => {
    if (entry) {
      setDraft(configDraftFromValue(entry.key, entry.value));
      setValidation({ fieldErrors: {} });
    }
  }, [entry]);
  const setField: SetField = (path, value) => {
    setDraft((prev) => ({ ...prev, [path]: value }));
    // Drop a stale error on the edited field (and any form-level error) so a corrected value does not
    // keep showing the previous submit's message until the next Save.
    setValidation((prev) => {
      if (!prev.fieldErrors[path] && prev.formError === undefined) return prev;
      return {
        fieldErrors: Object.fromEntries(
          Object.entries(prev.fieldErrors).filter(([key]) => key !== path),
        ),
      };
    });
  };
  const submit = (): void => {
    if (update.isPending || !entry) return;
    const result = validateConfigDraft(entry.key, draft);
    if (result.value === undefined) return setValidation(result);
    update.mutate(
      { key: entry.key, value: result.value },
      {
        onSuccess: () => {
          toast.show({ title: "Setting saved", tone: "success" });
          onClose();
        },
        onError: () => toast.show({ title: "Could not save the setting", tone: "danger" }),
      },
    );
  };
  return { draft, setField, validation, submit, pending: update.isPending };
}

interface EnumSetFieldProps {
  readonly field: ConfigEditField;
  readonly value: readonly string[];
  readonly setField: SetField;
}

/** A configuration value that is a set of fixed options, chosen with chips. */
function EnumSetField({ field, value, setField }: EnumSetFieldProps) {
  const toggle = (option: string): void =>
    setField(
      field.path,
      value.includes(option) ? value.filter((item) => item !== option) : [...value, option],
    );
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="muted">
        {field.label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {(field.options ?? []).map((option) => (
          <FilterChip
            key={option}
            label={configOptionLabel(option)}
            selected={value.includes(option)}
            onPress={() => toggle(option)}
            testID={`config-option-${option}`}
          />
        ))}
      </View>
    </Stack>
  );
}

interface FlagRowProps {
  readonly row: ConfigFlagRow;
  readonly onToggle: (name: string, enabled: boolean) => void;
  readonly onRemove: (name: string) => void;
}

/** One feature flag: its name, an on/off switch, and a remove action. */
function FlagRow({ row, onToggle, onRemove }: FlagRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Toggle
          label={row.name}
          value={row.enabled}
          onValueChange={(next) => onToggle(row.name, next)}
          testID={`config-flag-${row.name}`}
        />
      </View>
      <Button
        variant="ghost"
        size="sm"
        accessibilityLabel={`Remove ${row.name}`}
        onPress={() => onRemove(row.name)}
        testID={`config-flag-remove-${row.name}`}
      >
        Remove
      </Button>
    </View>
  );
}

/** The name field and Add button for a new feature flag; its own draft so the map's draft stays clean. */
function AddFlagInput({ onAdd }: { readonly onAdd: (name: string) => boolean }) {
  const [name, setName] = useState("");
  const add = (): void => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    // Clear the field only when the flag was actually added; a rejected duplicate keeps its name, so a
    // no-op never looks like a successful add.
    if (onAdd(trimmed)) setName("");
  };
  return (
    <View className="flex-row items-end gap-2">
      <View className="flex-1">
        <Input
          label="New flag"
          value={name}
          onChangeText={setName}
          placeholder="beta_checkout"
          autoCapitalize="none"
          testID="config-flag-name"
        />
      </View>
      <Button variant="secondary" onPress={add} testID="config-flag-add">
        Add
      </Button>
    </View>
  );
}

interface FlagMapFieldProps {
  readonly field: ConfigEditField;
  readonly rows: readonly ConfigFlagRow[];
  readonly setField: SetField;
}

/** A configuration value that is a record of named on/off switches, with add and remove. */
function FlagMapField({ field, rows, setField }: FlagMapFieldProps) {
  const toggle = (flag: string, enabled: boolean): void =>
    setField(
      field.path,
      rows.map((row) => (row.name === flag ? { ...row, enabled } : row)),
    );
  const remove = (flag: string): void =>
    setField(
      field.path,
      rows.filter((row) => row.name !== flag),
    );
  const add = (name: string): boolean => {
    if (rows.some((row) => row.name === name)) return false;
    setField(field.path, [...rows, { name, enabled: true }]);
    return true;
  };
  return (
    <Stack gap={3}>
      <Text variant="eyebrow" tone="muted">
        {field.label}
      </Text>
      {rows.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No feature flags yet.
        </Text>
      ) : (
        rows.map((row) => <FlagRow key={row.name} row={row} onToggle={toggle} onRemove={remove} />)
      )}
      <AddFlagInput onAdd={add} />
    </Stack>
  );
}

interface FieldControlProps {
  readonly field: ConfigEditField;
  readonly draft: ConfigDraft;
  readonly validation: ConfigValidation;
  readonly setField: SetField;
}

/** Renders one field by its kind: a number input, a switch, a chip set, or the flag map. */
function ConfigFieldControl({ field, draft, validation, setField }: FieldControlProps) {
  const value = draft[field.path];
  if (field.kind === "boolean") {
    return (
      <Toggle
        label={field.label}
        description={field.help}
        value={value === true}
        onValueChange={(next) => setField(field.path, next)}
        testID={`config-field-${field.path}`}
      />
    );
  }
  if (field.kind === "int") {
    return (
      <Input
        label={field.label}
        value={typeof value === "string" ? value : ""}
        onChangeText={(next) => setField(field.path, next)}
        keyboardType="number-pad"
        errorText={validation.fieldErrors[field.path]}
        helpText={field.help}
        testID={`config-field-${field.path}`}
      />
    );
  }
  if (field.kind === "enumSet") {
    return <EnumSetField field={field} value={stringsOf(value)} setField={setField} />;
  }
  return <FlagMapField field={field} rows={flagRowsOf(value)} setField={setField} />;
}

export interface ConfigurationEditSheetProps {
  readonly entry: ConfigEntry | null;
  readonly onClose: () => void;
}

/**
 * Edit one configuration value as a typed form (`admin.configurations.update`, Super Admin). Each field
 * renders by its kind — a whole-number input, an on/off switch, a set of chips, or a map of named flags
 * — and the assembled value is validated against the key's own `@ampm/core` schema before it is sent,
 * so the client and the server agree on what is valid. The server remains the real gate.
 *
 *   <ConfigurationEditSheet entry={editing} onClose={() => setEditing(null)} />
 */
export function ConfigurationEditSheet({ entry, onClose }: ConfigurationEditSheetProps) {
  const { draft, setField, validation, submit, pending } = useConfigEditForm(entry, onClose);
  const fields = entry ? configEditFields(entry.key) : [];
  const description = entry ? configDescription(entry.key) : "";
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={entry ? `Edit ${configLabel(entry.key)}` : "Edit setting"}
      size="full"
      testID="configuration-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="configuration-edit-submit">
          Save changes
        </Button>
      }
    >
      {entry ? (
        <Stack gap={4}>
          {description.length > 0 ? (
            <Text variant="bodySmall" tone="muted">
              {description}
            </Text>
          ) : null}
          {validation.formError ? (
            <Callout kind="danger" title={validation.formError} blur={false} />
          ) : null}
          {fields.map((field) => (
            <ConfigFieldControl
              key={field.path}
              field={field}
              draft={draft}
              validation={validation}
              setField={setField}
            />
          ))}
        </Stack>
      ) : null}
    </Sheet>
  );
}
