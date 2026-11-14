import { useState } from "react";

import { useUnsaveHotel } from "@ampm/api-client";
import { formatDay, type SavedHotelView } from "@ampm/core";
import { useToast } from "@ampm/ui";

import { destinationLabel } from "./hotels.format";

export interface SavedHotelRemoval {
  /** Takes the hotel off the shortlist; a failure is reported with a toast. */
  readonly remove: () => void;
  readonly removing: boolean;
}

/** Removing a shortlist entry, shared by the phone row and the desktop column. */
export function useSavedHotelRemoval(item: SavedHotelView): SavedHotelRemoval {
  const toast = useToast();
  const unsave = useUnsaveHotel(item.hotel.id);
  const remove = (): void => {
    unsave.mutate(undefined, {
      onError: () => toast.show({ title: "Could not remove the hotel", tone: "danger" }),
    });
  };
  return { remove, removing: unsave.isPending };
}

export interface SavedNoteEditor {
  /** The shortlist entry whose note is (or was last) being edited; kept while the sheet closes. */
  readonly entryId: string | null;
  readonly open: boolean;
  readonly start: (entryId: string) => void;
  readonly close: () => void;
}

/**
 * Which entry's note sheet is open. The screen holds it above the phone list / desktop grid switch, so
 * crossing 1024 (which swaps those trees) keeps the sheet and its draft. Closing keeps the entry, so the
 * sheet can play its exit before it empties.
 */
export function useSavedNoteEditor(): SavedNoteEditor {
  const [state, setState] = useState<{ readonly entryId: string | null; readonly open: boolean }>({
    entryId: null,
    open: false,
  });
  return {
    ...state,
    start: (entryId) => setState({ entryId, open: true }),
    close: () => setState((current) => ({ ...current, open: false })),
  };
}

/** The entry's spoken name: "Rose Fort Palace in Jaipur, Rajasthan, saved 14 Nov 2026". */
export function savedHotelLabel(item: SavedHotelView): string {
  const { hotel } = item;
  return `${hotel.name} in ${destinationLabel(hotel.destination)}, saved ${formatDay(item.savedAt)}`;
}
