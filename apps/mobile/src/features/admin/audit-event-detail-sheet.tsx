import { View } from "react-native";

import type { AuditEventView } from "@ampm/core";
import { Sheet, Stack, Text } from "@ampm/ui";

import { auditActionLabel, auditActorLabel, formatMoment } from "./audit-log.format";

function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

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

/** A recorded image (before/after), already masked at write time, in a flat well. */
function SnapshotBlock({ label, value }: { readonly label: string; readonly value: unknown }) {
  return (
    <Stack gap={1}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <View className="rounded bg-primary/6 p-3">
        <Text variant="data" tone="body">
          {jsonText(value)}
        </Text>
      </View>
    </Stack>
  );
}

export interface AuditEventDetailSheetProps {
  readonly event: AuditEventView | null;
  readonly onClose: () => void;
}

/** The full record for one audit event: who, what, when, from where, and the before/after images. */
export function AuditEventDetailSheet({ event, onClose }: AuditEventDetailSheetProps) {
  return (
    <Sheet
      open={event !== null}
      onClose={onClose}
      title="Audit event"
      size="full"
      testID="audit-event-detail"
    >
      {event ? (
        <Stack gap={3}>
          <Field label="When" value={formatMoment(event.occurredAt)} />
          <Field label="Action" value={auditActionLabel(event.action)} />
          <Field label="Entity" value={`${event.entityType} · ${event.entityId}`} />
          <Field
            label="Actor"
            value={
              auditActorLabel(event.actorType) +
              (event.actorUserId ? ` · ${event.actorUserId}` : "")
            }
          />
          <Field label="IP address" value={event.ipAddress ?? "—"} />
          <Field label="Request" value={event.requestId ?? "—"} />
          <SnapshotBlock label="Before" value={event.before} />
          <SnapshotBlock label="After" value={event.after} />
        </Stack>
      ) : null}
    </Sheet>
  );
}
