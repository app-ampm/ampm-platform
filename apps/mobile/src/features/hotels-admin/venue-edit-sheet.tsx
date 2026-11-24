import type { VenueView } from "@ampm/core";
import { Button, Sheet, Stack } from "@ampm/ui";

import { useVenueForm } from "./use-venue-form";
import { VenueBasicsPanel } from "./venue-basics-panel";
import { VenueCapacityPanel } from "./venue-capacity-panel";
import { VenueExtrasPanel } from "./venue-extras-panel";
import { VenueLayoutsPanel } from "./venue-layouts-panel";
import { VenueSizePanel } from "./venue-size-panel";

export interface VenueEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The venue being edited, or null to add a new one. */
  readonly venue: VenueView | null;
  readonly onClose: () => void;
}

/**
 * Add or edit a hotel event venue (TW-22; D-178), in flat panels inside the glass sheet: its name, type
 * and setting; its size (area in both units, length, width, ceiling height); the seated, theatre and
 * floating capacities with notes; other layouts; and the pre-function area and amenities. A blocked
 * save names the first field to fix and focuses it. Hotel team / Super Admin only, gated server-side.
 *
 *   <VenueEditSheet hotelId={hotelId} open={open} venue={editing} onClose={close} />
 */
export function VenueEditSheet({ hotelId, open, venue, onClose }: VenueEditSheetProps) {
  const { pending, submit, ...fields } = useVenueForm(hotelId, open, venue, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={venue ? "Edit venue" : "New venue"}
      size="full"
      testID="venue-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="venue-edit-submit">
          {venue ? "Save changes" : "Add venue"}
        </Button>
      }
    >
      <Stack gap={4}>
        <VenueBasicsPanel {...fields} />
        <VenueSizePanel {...fields} />
        <VenueCapacityPanel {...fields} />
        <VenueLayoutsPanel {...fields} />
        <VenueExtrasPanel {...fields} />
      </Stack>
    </Sheet>
  );
}
