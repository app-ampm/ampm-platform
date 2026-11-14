import { useUpdateSavedNote } from "@ampm/api-client";
import type { SavedHotelView } from "@ampm/core";
import { useToast } from "@ampm/ui";

import { NoteEditorSheet } from "@/components/note-editor-sheet";

import type { SavedNoteEditor } from "./use-saved-hotel-controls";

/** The longest note the API accepts (savedHotelNoteUpdateRequest); the editor caps input at the same length. */
const NOTE_MAX = 1000;

export interface SavedHotelNoteSheetProps {
  /** The shortlist's entries, to find the one being edited. */
  readonly entries: readonly SavedHotelView[];
  /** Which entry's sheet is open (or closing), held by the screen. */
  readonly editor: SavedNoteEditor;
}

/**
 * The note editor for a saved hotel (B15): the shared sheet wired to this hotel's save-note mutation. The
 * screen renders one for the whole shortlist, outside the phone list and the desktop grid; nothing renders
 * before an entry is picked or once it has left the shortlist.
 */
export function SavedHotelNoteSheet({ entries, editor }: SavedHotelNoteSheetProps) {
  const entry = entries.find((item) => item.id === editor.entryId);
  return entry ? (
    <EntryNoteSheet key={entry.id} entry={entry} open={editor.open} onClose={editor.close} />
  ) : null;
}

interface EntryNoteSheetProps {
  readonly entry: SavedHotelView;
  readonly open: boolean;
  readonly onClose: () => void;
}

function EntryNoteSheet({ entry, open, onClose }: EntryNoteSheetProps) {
  const toast = useToast();
  const { hotel } = entry;
  const update = useUpdateSavedNote(hotel.id);
  const save = (value: string | null): void =>
    update.mutate(
      { note: value },
      {
        onSuccess: onClose,
        onError: () => toast.show({ title: "Could not save your note", tone: "danger" }),
      },
    );
  return (
    <NoteEditorSheet
      open={open}
      onClose={onClose}
      title={`Note · ${hotel.name}`}
      initialNote={entry.note}
      onSave={save}
      saving={update.isPending}
      maxLength={NOTE_MAX}
      placeholder="e.g. great lawn, waiting on a quote"
      testID="saved-note-sheet"
    />
  );
}
