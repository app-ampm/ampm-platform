import { useEffect, useState } from "react";

import { useCreateRoom, useUpdateRoom } from "@ampm/api-client";
import { isAppError, type RoomCategoryView } from "@ampm/core";
import { Button, Input, Sheet, Stack, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import {
  buildRoomBody,
  draftFromRoom,
  validateRoom,
  type RoomDraft,
  type RoomErrors,
} from "./subresources.form";

const NO_ERRORS: RoomErrors = {
  name: undefined,
  roomCount: undefined,
  maxOccupancy: undefined,
  sizeSqm: undefined,
};

/** The room-category create/edit form's state, validation and submission. */
function useRoomForm(
  hotelId: string,
  open: boolean,
  room: RoomCategoryView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const create = useCreateRoom(hotelId);
  const update = useUpdateRoom(hotelId);
  const [draft, setDraft] = useState<RoomDraft>(() => draftFromRoom(room));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromRoom(room));
      setShowErrors(false);
    }
  }, [open, room]);
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the room category",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: room ? "Room category updated" : "Room category added", tone: "success" });
    onClose();
  };
  const patch = (next: Partial<RoomDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateRoom(draft))) return setShowErrors(true);
    const body = buildRoomBody(draft);
    if (room) update.mutate({ roomId: room.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return { draft, patch, errors: showErrors ? validateRoom(draft) : NO_ERRORS, pending, submit };
}

export interface RoomEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The room category being edited, or null to add a new one. */
  readonly room: RoomCategoryView | null;
  readonly onClose: () => void;
}

/** Add or edit a hotel room category (name, counts, size, facilities). Hotel team / Super Admin only. */
export function RoomEditSheet({ hotelId, open, room, onClose }: RoomEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useRoomForm(hotelId, open, room, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={room ? "Edit room category" : "New room category"}
      size="full"
      testID="room-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="room-edit-submit">
          {room ? "Save changes" : "Add room category"}
        </Button>
      }
    >
      <Stack gap={4}>
        <Input
          label="Name"
          required
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          errorText={errors.name}
          placeholder="e.g. Deluxe Lake View"
          testID="room-name"
        />
        <Input
          label="Number of rooms"
          value={draft.roomCount}
          onChangeText={(roomCount) => patch({ roomCount })}
          keyboardType="number-pad"
          errorText={errors.roomCount}
          testID="room-count"
        />
        <Input
          label="Max occupancy"
          value={draft.maxOccupancy}
          onChangeText={(maxOccupancy) => patch({ maxOccupancy })}
          keyboardType="number-pad"
          errorText={errors.maxOccupancy}
          testID="room-occupancy"
        />
        <Input
          label="Size (sqm)"
          value={draft.sizeSqm}
          onChangeText={(sizeSqm) => patch({ sizeSqm })}
          keyboardType="number-pad"
          errorText={errors.sizeSqm}
          testID="room-size"
        />
        <Input
          label="Facilities"
          helpText="Comma-separated, e.g. wifi, minibar, balcony"
          value={draft.facilities}
          onChangeText={(facilities) => patch({ facilities })}
          testID="room-facilities"
        />
        <Input
          label="Description"
          value={draft.description}
          onChangeText={(description) => patch({ description })}
          multiline
          testID="room-description"
        />
      </Stack>
    </Sheet>
  );
}
