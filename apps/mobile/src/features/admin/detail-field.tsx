import { Stack, Text } from "@ampm/ui";

export interface FieldProps {
  readonly label: string;
  readonly value: string;
}

/**
 * One fact in an admin detail sheet: its name as an eyebrow over its value, read out as one phrase. The
 * four detail sheets (audit event, configuration, notification, notification template) share it.
 *
 *   <Field label="Actor" value={auditActorLabel(event.actorType)} />
 */
export function Field({ label, value }: FieldProps) {
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
