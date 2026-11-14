import type { SavedHotelView } from "@ampm/core";
import { Button, Row } from "@ampm/ui";

import type { SavedHotelRemoval } from "./use-saved-hotel-controls";

export interface SavedHotelActionsProps {
  readonly item: SavedHotelView;
  readonly removal: SavedHotelRemoval;
  /** Opens the screen's note sheet for this entry. */
  readonly onEditNote: () => void;
  /** `icons` beside a phone row; `labelled` under a desktop column, where the words fit. */
  readonly variant: "icons" | "labelled";
}

/**
 * A shortlist entry's note and remove buttons, kept BESIDE the pressable hotel and never inside it. Each
 * spoken name carries the hotel, so a list of them stays unambiguous (WCAG 2.4.4), and starts with the
 * visible words when they show (2.5.3).
 */
export function SavedHotelActions({ item, removal, onEditNote, variant }: SavedHotelActionsProps) {
  const { hotel } = item;
  const labelled = variant === "labelled";
  const noteWords = item.note ? "Edit note" : "Add a note";
  return (
    <Row gap={1} align="center" justify={labelled ? "end" : "start"}>
      <Button
        variant="ghost"
        size={labelled ? "sm" : undefined}
        icon="edit"
        onPress={onEditNote}
        accessibilityLabel={`${noteWords} for ${hotel.name}`}
      >
        {labelled ? noteWords : undefined}
      </Button>
      <Button
        variant="ghost"
        size={labelled ? "sm" : undefined}
        icon="x"
        loading={removal.removing}
        onPress={removal.remove}
        accessibilityLabel={`Remove ${hotel.name} from your shortlist`}
      >
        {labelled ? "Remove" : undefined}
      </Button>
    </Row>
  );
}
