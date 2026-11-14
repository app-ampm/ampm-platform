import type { FieldNoteStatus } from "@ampm/core";
import {
  Card,
  Columns,
  EmptyState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useLayoutAt,
} from "@ampm/ui";
import { useState, type ReactNode } from "react";

import { FieldNotesSide } from "./field-notes-side";
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
  const isDesktop = useLayoutAt("lg");

  const submit = () => {
    controller.addNote(draft);
    setDraft("");
  };

  const list = <NoteList key="list" notes={controller.notes} isLoading={controller.isLoading} />;
  const side = (
    <FieldNotesSide
      key="side"
      controller={controller}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={submit}
    />
  );
  return (
    <Screen width="wide" tabBar={tabBar} header={<FieldNotesHeader controller={controller} />}>
      {/* M11 (1.3fr 1fr): the notes, then the status and composer beside them from 1024; a phone keeps
          the composer first. Keyed, so the swap moves the composer rather than remounting it. */}
      <Columns ratios={[1.3, 1]} gap={4} align="start" testID="field-notes-columns">
        {isDesktop ? [list, side] : [side, list]}
      </Columns>
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
        description="Record one with the composer; it saves offline and syncs on reconnection."
      />
    );
  }
  return (
    <Card padding="sm" testID="field-notes-list">
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
