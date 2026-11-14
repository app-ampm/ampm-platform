import { Button, Callout, Card, Input, OfflineBanner, Row, Stack } from "@ampm/ui";

import type { FieldNotesController } from "./use-field-notes";

interface ComposerProps {
  readonly draft: string;
  readonly onChange: (text: string) => void;
  readonly onSubmit: () => void;
  readonly onSync: () => void;
  readonly isSyncing: boolean;
}

function NoteComposer({ draft, onChange, onSubmit, onSync, isSyncing }: ComposerProps) {
  return (
    <Stack gap={3}>
      <Input
        label="New field note"
        value={draft}
        onChangeText={onChange}
        placeholder="e.g. Stage-left riser is wobbling"
        onSubmitEditing={onSubmit}
      />
      <Row gap={2} wrap>
        <Button onPress={onSubmit} disabled={draft.trim().length === 0}>
          Record note
        </Button>
        <Button variant="secondary" icon="refresh" onPress={onSync} loading={isSyncing}>
          Sync now
        </Button>
      </Row>
    </Stack>
  );
}

interface SyncBannerProps {
  readonly isOnline: boolean;
  readonly pendingCount: number;
  readonly hasSyncFailed: boolean;
}

/**
 * Offline, refused, or online with notes still waiting: the banner says so and counts them. A refused
 * sync is gold (needs the person), since waiting for the signal will not send those notes.
 */
function SyncBanner({ isOnline, pendingCount, hasSyncFailed }: SyncBannerProps) {
  if (!isOnline) return <OfflineBanner queuedCount={pendingCount} />;
  if (hasSyncFailed) {
    return (
      <Callout kind="danger" title="Notes could not sync">
        The server did not accept the sync. Notes you record stay on this device.
      </Callout>
    );
  }
  if (pendingCount > 0) {
    return (
      <OfflineBanner
        title="Syncing"
        queuedCount={pendingCount}
        description="They send as soon as the API answers."
      />
    );
  }
  return null;
}

export interface FieldNotesSideProps {
  readonly controller: FieldNotesController;
  /** The note being typed; held by the screen so it outlives any change of composition. */
  readonly draft: string;
  readonly onDraftChange: (text: string) => void;
  readonly onSubmit: () => void;
}

/**
 * The sync status over the composer: M11's action cards, beside the notes from 1024 and above them on a
 * phone, where recording a note comes first.
 */
export function FieldNotesSide({
  controller,
  draft,
  onDraftChange,
  onSubmit,
}: FieldNotesSideProps) {
  return (
    <Stack gap={4} testID="field-notes-side">
      <SyncBanner
        isOnline={controller.isOnline}
        pendingCount={controller.pendingCount}
        hasSyncFailed={controller.hasSyncFailed}
      />
      <Card>
        <NoteComposer
          draft={draft}
          onChange={onDraftChange}
          onSubmit={onSubmit}
          onSync={controller.sync}
          isSyncing={controller.isSyncing}
        />
      </Card>
    </Stack>
  );
}
