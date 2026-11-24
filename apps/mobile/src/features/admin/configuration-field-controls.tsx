import { useState } from "react";
import { View } from "react-native";

import { Button, FilterChip, Input, Select, Stack, Text, Toggle } from "@ampm/ui";

import {
  configOptionLabel,
  type ConfigDraft,
  type ConfigDraftValue,
  type ConfigEditField,
  type ConfigFlagRow,
  type ConfigValidation,
} from "./configuration.edit";

/*
 * The configuration editor's field controls, one per field kind: a whole-number input, an on/off switch,
 * a set of chips, a single choice, a text, and the map of named flags.
 */

/** Sets one field's draft value. */
export type SetField = (path: string, value: ConfigDraftValue) => void;

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

/** A single choice among fixed options (the hotel form's mode), each with what it does. */
function ChoiceField({ field, draft, validation, setField }: FieldControlProps) {
  const value = draft[field.path];
  return (
    <Select
      label={field.label}
      value={typeof value === "string" && value !== "" ? value : null}
      options={(field.options ?? []).map((option) => ({
        value: option,
        label: configOptionLabel(option),
        description: field.optionHelp?.[option],
      }))}
      onChange={(next) => setField(field.path, next)}
      helpText={field.help}
      errorText={validation.fieldErrors[field.path]}
      sheetTitle={field.label}
      testID={`config-field-${field.path}`}
    />
  );
}

/** A number or a text: the input for its kind, with its help and its error. */
function TextualField({ field, draft, validation, setField }: FieldControlProps) {
  const value = draft[field.path];
  const isNumber = field.kind === "int";
  return (
    <Input
      label={field.label}
      value={typeof value === "string" ? value : ""}
      onChangeText={(next) => setField(field.path, next)}
      keyboardType={
        isNumber ? "number-pad" : field.keyboard === "email" ? "email-address" : "default"
      }
      autoCapitalize={isNumber || field.keyboard === "email" ? "none" : "sentences"}
      errorText={validation.fieldErrors[field.path]}
      helpText={field.help}
      testID={`config-field-${field.path}`}
    />
  );
}

/**
 * Renders one field by its kind: a switch, a number or a text input, a single choice, a chip set, or the
 * flag map.
 */
export function ConfigFieldControl(props: FieldControlProps) {
  const { field, draft, setField } = props;
  const value = draft[field.path];
  switch (field.kind) {
    case "boolean":
      return (
        <Toggle
          label={field.label}
          description={field.help}
          value={value === true}
          onValueChange={(next) => setField(field.path, next)}
          testID={`config-field-${field.path}`}
        />
      );
    case "int":
    case "text":
      return <TextualField {...props} />;
    case "choice":
      return <ChoiceField {...props} />;
    case "enumSet":
      return <EnumSetField field={field} value={stringsOf(value)} setField={setField} />;
    case "flagMap":
      return <FlagMapField field={field} rows={flagRowsOf(value)} setField={setField} />;
  }
}
