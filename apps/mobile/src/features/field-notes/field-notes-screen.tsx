import {
  Button,
  Callout,
  Card,
  EmptyState,
  Input,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";
import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LocalNote } from "./offline-store";
import { useFieldNotes } from "./use-field-notes";

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4). Records a field note
 * that saves on the device and syncs when the API is reachable; the banner always shows whether the
 * app is offline and how many changes are pending (.claude/rules/offline.md), built from the shared
 * packages/ui components only. Reached from the gallery; removed when the real screens arrive.
 */
export function FieldNotesScreen() {
  const insets = useSafeAreaInsets();
  const controller = useFieldNotes();
  const [draft, setDraft] = useState("");

  const submit = () => {
    controller.addNote(draft);
    setDraft("");
  };

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Text variant="title">Field notes</Text>
      <Text tone="muted">
        {`Offline spike · ${controller.engine}. Notes save on the device and sync when the API is reachable.`}
      </Text>

      <SyncBanner isOnline={controller.isOnline} pendingCount={controller.pendingCount} />

      <Stack gap={2}>
        <Input
          label="New field note"
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. Stage-left riser is wobbling"
          onSubmitEditing={submit}
        />
        <Row gap={2} wrap>
          <Button onPress={submit} disabled={draft.trim().length === 0}>
            Record note
          </Button>
          <Button
            variant="secondary"
            icon="refresh"
            onPress={controller.sync}
            loading={controller.isSyncing}
          >
            Sync now
          </Button>
        </Row>
      </Stack>

      <NoteList notes={controller.notes} isLoading={controller.isLoading} />
    </ScrollView>
  );
}

function SyncBanner({
  isOnline,
  pendingCount,
}: {
  readonly isOnline: boolean;
  readonly pendingCount: number;
}) {
  const plural = pendingCount === 1 ? "" : "s";
  if (!isOnline) {
    return (
      <Callout kind="offline">{`Offline · ${pendingCount} change${plural} waiting to sync.`}</Callout>
    );
  }
  if (pendingCount > 0) {
    return <Callout kind="pending-sync">{`${pendingCount} change${plural} syncing…`}</Callout>;
  }
  return (
    <Callout kind="success" title="All changes synced">
      Nothing is waiting to send.
    </Callout>
  );
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
    <Stack gap={2}>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </Stack>
  );
}

function NoteCard({ note }: { readonly note: LocalNote }) {
  return (
    <Card>
      <Stack gap={1}>
        <Row gap={2} wrap>
          <StatusChip label={note.status} tone="info" size="sm" />
          {note.pending ? (
            <StatusChip label="pending" tone="warning" size="sm" />
          ) : (
            <StatusChip label={`v${note.version}`} tone="success" size="sm" />
          )}
        </Row>
        <Text>{note.body}</Text>
      </Stack>
    </Card>
  );
}
