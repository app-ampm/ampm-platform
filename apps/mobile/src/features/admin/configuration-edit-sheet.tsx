import { useEffect, useState } from "react";

import { useUpdateConfiguration } from "@ampm/api-client";
import { Button, Callout, Sheet, Stack, Text, useToast } from "@ampm/ui";

import { configDescription, configLabel, type ConfigEntry } from "./configuration.format";
import { ConfigFieldControl, type SetField } from "./configuration-field-controls";
import {
  configDraftFromValue,
  configEditFields,
  validateConfigDraft,
  type ConfigDraft,
  type ConfigValidation,
} from "./configuration.edit";

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

export interface ConfigurationEditSheetProps {
  readonly entry: ConfigEntry | null;
  readonly onClose: () => void;
}

/**
 * Edit one configuration value as a typed form (`admin.configurations.update`, Super Admin). Each field
 * renders by its kind — a whole-number input, an on/off switch, a single choice, a text, a set of chips,
 * or a map of named flags — and the assembled value is validated against the key's own `@ampm/core` schema before it is sent,
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
