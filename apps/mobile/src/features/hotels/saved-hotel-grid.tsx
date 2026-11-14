import type { useSavedHotels } from "@ampm/api-client";
import type { SavedHotelView } from "@ampm/core";
import { Card, Grid, LoadMore } from "@ampm/ui";

import { HotelCompareCheckbox } from "./hotel-compare-select";
import { destinationLabel } from "./hotels.format";
import { SavedHotelCard } from "./saved-hotel-card";

export interface SavedHotelGridProps {
  readonly saved: ReturnType<typeof useSavedHotels>;
  readonly comparing: boolean;
  readonly selected: readonly string[];
  readonly onToggle: (hotelId: string) => void;
  readonly onOpen: (hotelId: string) => void;
  /** Opens the screen's note sheet for a shortlist entry (by its entry id). */
  readonly onEditNote: (entryId: string) => void;
}

/**
 * The shortlist on a desktop (D7): one glass card across the page holding the hotels side by side, three
 * columns to a row, each headed by its photo and name, then a "Load more" footer (B10). Compare mode puts
 * a pick in each column instead of its buttons, so the layout holds while the 2–4 are chosen.
 */
export function SavedHotelGrid({
  saved,
  comparing,
  selected,
  onToggle,
  onOpen,
  onEditNote,
}: SavedHotelGridProps) {
  return (
    <Card padding="lg" className="lg:px-8 lg:py-7.5" testID="saved-grid">
      <Grid columns={{ md: 2, lg: 3 }} gap={6}>
        {saved.items.map((item, index) => (
          <SavedHotelCard
            key={item.id}
            item={item}
            index={index}
            onOpen={() => onOpen(item.hotel.id)}
            onEditNote={() => onEditNote(item.id)}
            comparePick={comparing ? comparePick(item, selected, onToggle) : undefined}
          />
        ))}
      </Grid>
      <LoadMore
        hasMore={saved.hasMore}
        loading={saved.isLoadingMore}
        failed={saved.loadMoreError}
        onLoadMore={saved.loadMore}
        testID="saved-load-more"
      />
    </Card>
  );
}

/** A column's compare pick: just "Compare", since its photo and name already say which hotel it is. */
function comparePick(
  item: SavedHotelView,
  selected: readonly string[],
  onToggle: (hotelId: string) => void,
) {
  return (
    <HotelCompareCheckbox
      hotelId={item.hotel.id}
      name={item.hotel.name}
      destinationText={destinationLabel(item.hotel.destination)}
      selected={selected}
      onToggle={onToggle}
      label="Compare"
    />
  );
}
