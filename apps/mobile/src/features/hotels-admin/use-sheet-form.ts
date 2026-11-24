import { useEffect, useState } from "react";

import { isAppError } from "@ampm/core";
import { useToast } from "@ampm/ui";

import { blockedSaveToastFor } from "./hotel-form-fields";
import { useFieldFocus, type FieldFocus } from "./use-field-focus";

/*
 * The parts every room, venue and contact editor shares: the draft, re-seeded each time its sheet opens;
 * the toasts of a save; and the blocked save, which names the first field to fix and focuses it, since
 * in a long sheet it may sit in a panel out of sight (the profile editor's way, D-178).
 */

export interface SheetDraft<D> {
  readonly draft: D;
  readonly patch: (next: Partial<D>) => void;
  /** Whether the checks' errors are on show: only after a save they blocked. */
  readonly showErrors: boolean;
  readonly setShowErrors: (show: boolean) => void;
}

/**
 * A sheet's draft, seeded from what it edits each time the sheet opens, so "New" starts clean and an edit
 * shows the current values. `draftFrom` is a module function: the seeding effect depends on it.
 *
 *   const { draft, patch } = useSheetDraft(open, room, draftFromRoom);
 */
export function useSheetDraft<S, D extends object>(
  open: boolean,
  source: S,
  draftFrom: (source: S) => D,
): SheetDraft<D> {
  const [draft, setDraft] = useState<D>(() => draftFrom(source));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFrom(source));
      setShowErrors(false);
    }
  }, [open, source, draftFrom]);
  const patch = (next: Partial<D>): void => setDraft((prev) => ({ ...prev, ...next }));
  return { draft, patch, showErrors, setShowErrors };
}

/** What a sheet's save toasts say. */
export interface SaveMessages {
  readonly added: string;
  readonly updated: string;
  /** When the server's error carries no message of its own. */
  readonly failed: string;
}

/** A save's success (a toast, then the sheet closes) and its failure (the server's message). */
export function useSaveOutcome(messages: SaveMessages, isEdit: boolean, onClose: () => void) {
  const toast = useToast();
  return {
    onSuccess: (): void => {
      toast.show({ title: isEdit ? messages.updated : messages.added, tone: "success" });
      onClose();
    },
    onError: (error: unknown): void =>
      void toast.show({
        title: isAppError(error) ? error.message : messages.failed,
        tone: "danger",
      }),
  };
}

export interface BlockedSave<K extends string> extends Pick<FieldFocus<K>, "fieldRef"> {
  /** Names the first field with an error in a toast and focuses it; true when the save is blocked. */
  readonly blocked: (errors: Readonly<Record<K, string | undefined>>) => boolean;
}

/**
 * The blocked save of a sheet whose fields are `order`, top to bottom, labelled by `labels`.
 *
 *   const checks = useBlockedSave(ROOM_FIELD_LABEL, ROOM_FIELD_ORDER);
 *   if (checks.blocked(validateRoom(draft))) return setShowErrors(true);
 */
export function useBlockedSave<K extends string>(
  labels: Readonly<Record<K, string>>,
  order: readonly K[],
): BlockedSave<K> {
  const toast = useToast();
  const focus = useFieldFocus<K>();
  const blocked = (errors: Readonly<Record<K, string | undefined>>): boolean => {
    const first = order.find((key) => errors[key] !== undefined);
    if (first === undefined) return false;
    toast.show(blockedSaveToastFor(labels[first], errors[first] ?? ""));
    focus.focusField(first);
    return true;
  };
  return { blocked, fieldRef: focus.fieldRef };
}
