import { useUnsaveHotel } from "@ampm/api-client";
import { formatDay, type SavedHotelView } from "@ampm/core";
import { Button, ListItem, PhotoPlaceholder, Row, StatusChip, useToast } from "@ampm/ui";

import { destinationLabel, starLabel } from "./hotels.format";

export interface SavedHotelRowProps {
  readonly item: SavedHotelView;
  readonly onOpen: () => void;
}

/**
 * One hotel in "My selection" (D7, P2): a row with its photo stand-in, name, destination and the day
 * it was saved, opening the hotel; the remove button sits beside the row, never inside a pressable one.
 */
export function SavedHotelRow({ item, onOpen }: SavedHotelRowProps) {
  const toast = useToast();
  const unsave = useUnsaveHotel(item.hotel.id);
  const { hotel } = item;
  const where = destinationLabel(hotel.destination);
  const savedOn = formatDay(item.savedAt);
  const onRemove = (): void => {
    unsave.mutate(undefined, {
      onError: () => toast.show({ title: "Could not remove the hotel", tone: "danger" }),
    });
  };
  return (
    <Row gap={1} className="border-t border-primary/16">
      <ListItem
        tone="plain"
        className="flex-1 border-t-0"
        title={hotel.name}
        subtitle={where}
        meta={`Saved ${formatDay(item.savedAt, { style: "data" })}`}
        leading={<Thumbnail destination={hotel.destination.name} />}
        trailing={hotel.starCategory ? <StarChip starCategory={hotel.starCategory} /> : undefined}
        accessibilityLabel={`${hotel.name} in ${where}, saved ${savedOn}`}
        onPress={onOpen}
      />
      <Button
        variant="ghost"
        icon="x"
        loading={unsave.isPending}
        onPress={onRemove}
        accessibilityLabel={`Remove ${hotel.name} from your shortlist`}
      />
    </Row>
  );
}

function Thumbnail({ destination }: { readonly destination: string }) {
  return (
    <PhotoPlaceholder
      label={`Hotel photo · ${destination}`}
      showLabel={false}
      className="h-10 w-12 rounded-sm"
    />
  );
}

function StarChip({ starCategory }: { readonly starCategory: string }) {
  return <StatusChip label={starLabel(starCategory)} tone="brand" size="sm" />;
}
