import type { RefCallback } from "react";

import { useCreateRoom, useUpdateRoom } from "@ampm/api-client";
import type { RoomCategoryView } from "@ampm/core";

import {
  buildRoomBody,
  draftFromRoom,
  ROOM_FIELD_LABEL,
  ROOM_FIELD_ORDER,
  roomUpdateBody,
  validateRoom,
  type RoomDraft,
  type RoomField,
} from "./rooms.form";
import type { FieldNode } from "./use-field-focus";
import { useBlockedSave, useSaveOutcome, useSheetDraft } from "./use-sheet-form";

/** What each panel of the room editor takes. */
export interface RoomFieldsProps {
  readonly draft: RoomDraft;
  readonly patch: (next: Partial<RoomDraft>) => void;
  /** The errors on show: none until a save has been blocked by the checks. */
  readonly errors: Partial<Record<RoomField, string | undefined>>;
  readonly fieldRef: (key: RoomField) => RefCallback<FieldNode>;
}

/** A checked text box of the room editor, to spread on its Input or AreaFields. */
export interface RoomFieldBinding {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly errorText: string | undefined;
  readonly ref: RefCallback<FieldNode>;
}

/**
 * A checked field's value, setter, error on show and focus ref.
 *
 * @example
 * <Input label="Number of rooms" {...roomField(props, "roomCount")} testID="room-count" />
 */
export function roomField(props: RoomFieldsProps, key: RoomField): RoomFieldBinding {
  return {
    value: props.draft[key],
    onChangeText: (value) => props.patch({ [key]: value }),
    errorText: props.errors[key],
    ref: props.fieldRef(key),
  };
}

export interface RoomForm extends RoomFieldsProps {
  readonly pending: boolean;
  readonly submit: () => void;
}

const MESSAGES = {
  added: "Room category added",
  updated: "Room category updated",
  failed: "Could not save the room category",
};

/**
 * The room category editor's state, checks and save. A blocked save names the first field to fix and
 * focuses it; an edit sends only what it changed, and one that changed nothing closes the sheet.
 *
 *   const form = useRoomForm(hotelId, open, room, onClose);
 */
export function useRoomForm(
  hotelId: string,
  open: boolean,
  room: RoomCategoryView | null,
  onClose: () => void,
): RoomForm {
  const create = useCreateRoom(hotelId);
  const update = useUpdateRoom(hotelId);
  const { draft, patch, showErrors, setShowErrors } = useSheetDraft(open, room, draftFromRoom);
  const checks = useBlockedSave(ROOM_FIELD_LABEL, ROOM_FIELD_ORDER);
  const outcome = useSaveOutcome(MESSAGES, room !== null, onClose);
  const pending = create.isPending || update.isPending;
  const submit = (): void => {
    if (pending) return;
    if (checks.blocked(validateRoom(draft))) return setShowErrors(true);
    if (!room) return create.mutate(buildRoomBody(draft), outcome);
    const body = roomUpdateBody(draft, room);
    if (Object.keys(body).length === 0) return onClose();
    update.mutate({ roomId: room.id, body }, outcome);
  };
  const errors = showErrors ? validateRoom(draft) : {};
  return { draft, patch, errors, fieldRef: checks.fieldRef, pending, submit };
}
