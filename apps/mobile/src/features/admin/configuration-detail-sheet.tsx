import { Button, Sheet, Stack, Text } from "@ampm/ui";

import {
  configDescription,
  configFields,
  configLabel,
  type ConfigEntry,
} from "./configuration.format";

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack gap={1} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <Text variant="bodySmall" tone="primary">
        {value}
      </Text>
    </Stack>
  );
}

export interface ConfigurationDetailSheetProps {
  readonly entry: ConfigEntry | null;
  readonly onClose: () => void;
  /** Present only for a Super Admin on an editable key; opens the edit form. */
  readonly onEdit?: (() => void) | undefined;
}

/**
 * The full value of one configuration key: its key, what it controls, and each field of the value
 * rendered readably (booleans as On/Off, lists joined). Read-only for everyone; a Super Admin gets an
 * Edit action (`onEdit`) that opens the typed editor (`admin.configurations.update`). Finance and other
 * readers see no Edit action — the server is the real gate either way.
 */
export function ConfigurationDetailSheet({
  entry,
  onClose,
  onEdit,
}: ConfigurationDetailSheetProps) {
  const fields = entry ? configFields(entry.value) : [];
  const description = entry ? configDescription(entry.key) : "";
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={entry ? configLabel(entry.key) : "Configuration"}
      size="full"
      testID="configuration-detail"
      footer={
        onEdit ? (
          <Button fullWidth variant="secondary" onPress={onEdit} testID="configuration-edit-open">
            Edit
          </Button>
        ) : undefined
      }
    >
      {entry ? (
        <Stack gap={3}>
          <Field label="Key" value={entry.key} />
          {description.length > 0 ? <Field label="About" value={description} /> : null}
          {fields.length > 0 ? (
            fields.map((field, index) => (
              <Field key={`${field.label}-${index}`} label={field.label} value={field.value} />
            ))
          ) : (
            <Text variant="bodySmall" tone="muted">
              Nothing configured — the default applies.
            </Text>
          )}
        </Stack>
      ) : null}
    </Sheet>
  );
}
