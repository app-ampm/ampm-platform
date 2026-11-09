import { Sheet, Stack, Text } from "@ampm/ui";

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
}

/**
 * The full value of one configuration key: its key, what it controls, and each field of the value
 * rendered readably (booleans as On/Off, lists joined). Read-only — a Super Admin edits a value as
 * configuration (`admin.configurations.update`); editing from here is a later slice.
 */
export function ConfigurationDetailSheet({ entry, onClose }: ConfigurationDetailSheetProps) {
  const fields = entry ? configFields(entry.value) : [];
  const description = entry ? configDescription(entry.key) : "";
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={entry ? configLabel(entry.key) : "Configuration"}
      size="full"
      testID="configuration-detail"
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
