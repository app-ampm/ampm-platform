import type { FieldNoteStatus } from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  EmptyState,
  Input,
  OfflineBanner,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";
import { useState, type ReactNode } from "react";

import type { LocalNote } from "./offline-store";
import { useFieldNotes, type FieldNotesController } from "./use-field-notes";

export interface FieldNotesScreenProps {
  /** The app's tab bar on a phone (the route passes `<AppTabBar />`); this screen is Tasks. */
  readonly tabBar?: ReactNode;
}

const STATUS_LABEL: Record<FieldNoteStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4), the staff workspace's
 * Tasks area until the real task screens arrive (M5). Records a field note that saves on the device
 * and syncs when the API is reachable; the screen always shows whether it is offline and how many
 * changes are pending (.claude/rules/offline.md): a peacock banner while notes wait or the device is
 * offline, a gold notice when the API refuses the sync, a "Synced" chip by the title once everything
 * is sent.
 */
export function FieldNotesScreen({ tabBar }: FieldNotesScreenProps) {
  const controller = useFieldNotes();
  const [draft, setDraft] = useState("");

  const submit = () => {
    controller.addNote(draft);
    setDraft("");
  };

  return (
    <Screen width="wide" tabBar={tabBar} header={<FieldNotesHeader controller={controller} />}>
      <SyncBanner
        isOnline={controller.isOnline}
        pendingCount={controller.pendingCount}
        hasSyncFailed={controller.hasSyncFailed}
      />
      <Card>
        <NoteComposer
          draft={draft}
          onChange={setDraft}
          onSubmit={submit}
          onSync={controller.sync}
          isSyncing={controller.isSyncing}
        />
      </Card>
      <NoteList notes={controller.notes} isLoading={controller.isLoading} />
    </Screen>
  );
}

function FieldNotesHeader({ controller }: { readonly controller: FieldNotesController }) {
  const { engine, isLoading, isOnline, pendingCount, hasSyncFailed } = controller;
  const isSynced = !isLoading && isOnline && pendingCount === 0 && !hasSyncFailed;
  const spike = engine ? `Offline spike · ${engine}` : "Offline spike";
  return (
    <ScreenHeader
      title="Field notes"
      subtitle={`${spike}. Notes save on the device and sync when the API is reachable.`}
      trailing={isSynced ? <StatusChip label="Synced" tone="success" dot /> : undefined}
    />
  );
}

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

function NoteList({
  notes,
  isLoading,
}: {
  readonly notes: readonly LocalNote[];
  readonly isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Stack gap={2} testID="field-notes-loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </Stack>
    );
  }
  if (notes.length === 0) {
    return (
      <EmptyState
        title="No field notes yet"
        description="Record one above; it saves offline and syncs on reconnection."
      />
    );
  }
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} />
        ))}
      </Stack>
    </Card>
  );
}

/**
 * A note as a flat row: its whole text (a note runs to several lines, and there is no detail screen to
 * read the rest on), its status, and whether it still waits to sync or which version it is.
 */
function NoteRow({ note }: { readonly note: LocalNote }) {
  return (
    <Card tone="flat" padding="sm">
      <Stack gap={1.5}>
        <Text tone="primary">{note.body}</Text>
        <Row gap={2} wrap>
          <StatusChip label={STATUS_LABEL[note.status]} tone="info" size="sm" />
          {note.pending ? (
            <StatusChip label="Queued" tone="warning" size="sm" />
          ) : (
            <StatusChip label={`Synced · v${note.version}`} tone="success" size="sm" />
          )}
        </Row>
      </Stack>
    </Card>
  );
}
