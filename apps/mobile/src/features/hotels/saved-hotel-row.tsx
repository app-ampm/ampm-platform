import { Pressable, View } from "react-native";

import { formatDay, type SavedHotelView } from "@ampm/core";
import { cn, Row, Stack, StatusChip, Text } from "@ampm/ui";
import { listItemStyles } from "@ampm/ui/styles";

import { destinationLabel, starLabel } from "./hotels.format";
import { SavedHotelActions } from "./saved-hotel-actions";
import { SavedHotelPhoto } from "./saved-hotel-photo";
import { savedHotelLabel, useSavedHotelRemoval } from "./use-saved-hotel-controls";

export interface SavedHotelRowProps {
  readonly item: SavedHotelView;
  /** Opens a hotel's page, by its id. */
  readonly onOpen: (hotelId: string) => void;
  /** Opens the screen's note sheet for an entry, by its id (the screen holds it, so it outlives this row). */
  readonly onEditNote: (entryId: string) => void;
}

/**
 * One hotel in "My selection" on a phone or tablet (D7, P2): a row with its photo stand-in, name, star,
 * destination and the day it was saved, opening the hotel; the note and remove buttons sit BESIDE the
 * row, never inside a pressable one. The client's own note (B15) shows under the row, and the note button
 * opens a sheet to edit it.
 */
export function SavedHotelRow({ item, onOpen, onEditNote }: SavedHotelRowProps) {
  const removal = useSavedHotelRemoval(item);
  return (
    <Stack gap={1} className="border-t border-primary/16">
      <Row gap={1} align="center">
        <SavedRowLink item={item} onOpen={() => onOpen(item.hotel.id)} />
        <SavedHotelActions
          item={item}
          removal={removal}
          onEditNote={() => onEditNote(item.id)}
          variant="icons"
        />
      </Row>
      {item.note ? (
        <Text variant="caption" tone="muted" className="px-1 pb-1">
          {item.note}
        </Text>
      ) : null}
    </Stack>
  );
}

interface SavedRowLinkProps {
  readonly item: SavedHotelView;
  readonly onOpen: () => void;
}

/**
 * The pressable hotel, in the shared row recipe. The name may wrap to a second line and the star chip sits
 * under it, beside the destination: on a phone the two buttons leave the text little room, and a chip on
 * the name's line used to cut the name short ("Rose Fort P…").
 */
function SavedRowLink({ item, onOpen }: SavedRowLinkProps) {
  const { hotel } = item;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={savedHotelLabel(item)}
      onPress={onOpen}
      className={cn(listItemStyles({ tone: "plain", pressable: true }), "flex-1 border-t-0")}
    >
      {/* Decorative: the row's name says which hotel it is. */}
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="shrink-0 self-start"
      >
        <SavedHotelPhoto hotel={hotel} className="h-10 w-12 rounded-sm" />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="body" weight="semibold" tone="primary" numberOfLines={2}>
          {hotel.name}
        </Text>
        <Row gap={2} align="center" wrap>
          {hotel.starCategory ? (
            <StatusChip label={starLabel(hotel.starCategory)} tone="brand" size="sm" />
          ) : null}
          <Text variant="bodySmall" tone="muted">
            {destinationLabel(hotel.destination)}
          </Text>
        </Row>
        <Text variant="data" tone="muted" numberOfLines={1}>
          {`Saved ${formatDay(item.savedAt, { style: "data" })}`}
        </Text>
      </View>
    </Pressable>
  );
}
