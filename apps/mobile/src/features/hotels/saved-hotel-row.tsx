import { useEffect, useState } from "react";

import { useUnsaveHotel, useUpdateSavedNote } from "@ampm/api-client";
import { formatDay, type HotelView, type SavedHotelView } from "@ampm/core";
import {
  Button,
  Image,
  Input,
  ListItem,
  PhotoPlaceholder,
  Row,
  Sheet,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { destinationLabel, starLabel } from "./hotels.format";

/** The longest note the API accepts (savedHotelNoteUpdateRequest); the editor caps input at the same length. */
const NOTE_MAX = 1000;

export interface SavedHotelRowProps {
  readonly item: SavedHotelView;
  readonly onOpen: () => void;
}

/**
 * One hotel in "My selection" (D7, P2): a row with its photo stand-in, name, destination and the day it
 * was saved, opening the hotel; the remove and note buttons sit BESIDE the row, never inside a pressable
 * one. The client's own note (B15) shows under the row, and the note button opens a sheet to edit it.
 */
export function SavedHotelRow({ item, onOpen }: SavedHotelRowProps) {
  const toast = useToast();
  const unsave = useUnsaveHotel(item.hotel.id);
  const [editing, setEditing] = useState(false);
  const onRemove = (): void => {
    unsave.mutate(undefined, {
      onError: () => toast.show({ title: "Could not remove the hotel", tone: "danger" }),
    });
  };
  return (
    <Stack gap={1} className="border-t border-primary/16">
      <SavedRowBar
        item={item}
        onOpen={onOpen}
        onEdit={() => setEditing(true)}
        onRemove={onRemove}
        removing={unsave.isPending}
      />
      {item.note ? (
        <Text variant="caption" tone="muted" className="px-1 pb-1">
          {item.note}
        </Text>
      ) : null}
      <NoteSheet
        open={editing}
        onClose={() => setEditing(false)}
        hotel={item.hotel}
        note={item.note}
      />
    </Stack>
  );
}

interface SavedRowBarProps {
  readonly item: SavedHotelView;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
  readonly removing: boolean;
}

/** The row itself: the pressable hotel, then the note and remove buttons beside it (never nested inside it). */
function SavedRowBar({ item, onOpen, onEdit, onRemove, removing }: SavedRowBarProps) {
  const { hotel } = item;
  const where = destinationLabel(hotel.destination);
  const savedOn = formatDay(item.savedAt);
  return (
    <Row gap={1}>
      <ListItem
        tone="plain"
        className="flex-1 border-t-0"
        title={hotel.name}
        subtitle={where}
        meta={`Saved ${formatDay(item.savedAt, { style: "data" })}`}
        leading={<Thumbnail hotel={hotel} />}
        trailing={hotel.starCategory ? <StarChip starCategory={hotel.starCategory} /> : undefined}
        accessibilityLabel={`${hotel.name} in ${where}, saved ${savedOn}`}
        onPress={onOpen}
      />
      <Button
        variant="ghost"
        icon="edit"
        onPress={onEdit}
        accessibilityLabel={`${item.note ? "Edit" : "Add a"} note for ${hotel.name}`}
      />
      <Button
        variant="ghost"
        icon="x"
        loading={removing}
        onPress={onRemove}
        accessibilityLabel={`Remove ${hotel.name} from your shortlist`}
      />
    </Row>
  );
}

interface NoteSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly hotel: HotelView;
  readonly note: string | null;
}

/** The draft and the save for the note sheet: seeded from the saved note each open, blank saved as a clear. */
function useNoteDraft(hotelId: string, note: string | null, open: boolean, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateSavedNote(hotelId);
  const [draft, setDraft] = useState(note ?? "");
  // Reseed the field each time the sheet opens; the saved note may have changed since the last edit.
  useEffect(() => {
    if (open) setDraft(note ?? "");
  }, [open, note]);
  const save = (): void => {
    update.mutate(
      { note: draft.trim() ? draft : null },
      {
        onSuccess: onClose,
        onError: () => toast.show({ title: "Could not save your note", tone: "danger" }),
      },
    );
  };
  return { draft, setDraft, save, saving: update.isPending };
}

/** The note editor as a sheet: a multiline field seeded with the saved note, saving blank as a cleared note. */
function NoteSheet({ open, onClose, hotel, note }: NoteSheetProps) {
  const { draft, setDraft, save, saving } = useNoteDraft(hotel.id, note, open, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Note · ${hotel.name}`}
      size="auto"
      testID="saved-note-sheet"
      footer={
        <Button variant="primary" loading={saving} onPress={save} className="self-stretch">
          Save note
        </Button>
      }
    >
      <Input
        label="Your note"
        multiline
        numberOfLines={4}
        value={draft}
        onChangeText={setDraft}
        maxLength={NOTE_MAX}
        placeholder="e.g. great lawn, waiting on a quote"
      />
    </Sheet>
  );
}

function Thumbnail({ hotel }: { readonly hotel: HotelView }) {
  return hotel.coverUrl ? (
    <Image
      source={{ uri: hotel.coverUrl }}
      alt={`Photo of ${hotel.name}`}
      radius="none"
      className="h-10 w-12 rounded-sm"
    />
  ) : (
    <PhotoPlaceholder
      label={`Hotel photo · ${hotel.destination.name}`}
      showLabel={false}
      className="h-10 w-12 rounded-sm"
    />
  );
}

function StarChip({ starCategory }: { readonly starCategory: string }) {
  return <StatusChip label={starLabel(starCategory)} tone="brand" size="sm" />;
}
