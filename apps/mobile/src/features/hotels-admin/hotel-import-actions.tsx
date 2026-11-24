import { Button, Row, Stack, Text } from "@ampm/ui";

import { PREVIEW_TTL_TEXT } from "./hotel-import.rules";

export interface ImportActionsProps {
  readonly pending: boolean;
  readonly canImport: boolean;
  /** Why Import is locked (validate first, nothing to import, or the server's word), or null. */
  readonly lockNote: string | null;
  readonly onValidate: () => void;
  readonly onImport: () => void;
}

/**
 * Validate first (a preview that saves nothing), then Import, the screen's gold action, which applies
 * that preview. Under them: why Import is locked, or, while it is not, how long the preview keeps.
 *
 *   <ImportActions pending={pending} canImport={canImport} lockNote={lockNote} onValidate={…} onImport={…} />
 */
export function ImportActions({
  pending,
  canImport,
  lockNote,
  onValidate,
  onImport,
}: ImportActionsProps) {
  return (
    <Stack gap={2}>
      <Row gap={2} wrap>
        <Button
          variant="secondary"
          loading={pending}
          onPress={onValidate}
          testID="hotel-import-validate"
        >
          Validate
        </Button>
        <Button
          variant="primary"
          loading={pending}
          disabled={!canImport}
          onPress={onImport}
          testID="hotel-import-run"
        >
          Import
        </Button>
      </Row>
      {lockNote === null ? (
        <Text variant="bodySmall" tone="muted" testID="hotel-import-ttl">
          {`${PREVIEW_TTL_TEXT}.`}
        </Text>
      ) : (
        <Text variant="bodySmall" tone="muted" testID="hotel-import-locked">
          {lockNote}
        </Text>
      )}
    </Stack>
  );
}
