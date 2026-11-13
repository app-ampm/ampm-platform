import { useEffect, useState } from "react";

import { Button, Input, Sheet } from "@ampm/ui";

export interface NoteEditorSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The sheet title, e.g. "Note · The Lake Pavilion" or "Your note". */
  readonly title: string;
  /** The note currently saved; the field is seeded from it each time the sheet opens. */
  readonly initialNote: string | null;
  /** Save the trimmed draft, or null when the field is blank (a cleared note). The caller owns the mutation. */
  readonly onSave: (value: string | null) => void;
  readonly saving: boolean;
  readonly maxLength: number;
  readonly label?: string;
  readonly placeholder?: string;
  readonly testID?: string;
}

/** The draft field for a note sheet, reseeded from the saved note each time the sheet opens. */
function useNoteDraft(initialNote: string | null, open: boolean) {
  const [draft, setDraft] = useState(initialNote ?? "");
  // The saved note may have changed since the last edit, so reseed whenever the sheet (re)opens.
  useEffect(() => {
    if (open) setDraft(initialNote ?? "");
  }, [open, initialNote]);
  return [draft, setDraft] as const;
}

function SaveNoteButton({
  onPress,
  saving,
}: {
  readonly onPress: () => void;
  readonly saving: boolean;
}) {
  return (
    <Button variant="primary" loading={saving} onPress={onPress} className="self-stretch">
      Save note
    </Button>
  );
}

/**
 * A client's free-text note, edited in a sheet: a multiline field seeded with the saved note, saving blank
 * as a cleared note. Shared by the saved-hotel shortlist (B15) and the hotel-assistance enquiry (B19); the
 * caller wires its own mutation through `onSave` and reports `saving`, so this stays presentational.
 */
export function NoteEditorSheet({
  open,
  onClose,
  title,
  initialNote,
  onSave,
  saving,
  maxLength,
  label = "Your note",
  placeholder,
  testID,
}: NoteEditorSheetProps) {
  const [draft, setDraft] = useNoteDraft(initialNote, open);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="auto"
      testID={testID}
      footer={
        <SaveNoteButton saving={saving} onPress={() => onSave(draft.trim() ? draft : null)} />
      }
    >
      <Input
        label={label}
        multiline
        numberOfLines={4}
        value={draft}
        onChangeText={setDraft}
        maxLength={maxLength}
        placeholder={placeholder}
      />
    </Sheet>
  );
}
