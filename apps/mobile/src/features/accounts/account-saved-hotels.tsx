import { useRouter } from "expo-router";

import { useClientSavedHotels, type CursorListResult } from "@ampm/api-client";
import type { SavedHotelStaffView } from "@ampm/core";
import {
  Card,
  ListItem,
  LoadMore,
  SectionError,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import {
  savedHotelDay,
  savedHotelNote,
  savedHotelPlace,
  savedHotelStatusChip,
  savedHotelSummary,
  savedHotelsCount,
} from "./saved-hotels.format";

/**
 * One hotel the client saved: its name (the client is the page), where it is with the client's note,
 * and the day they saved it; a chip when the catalogue no longer shows it to clients. Opens the hotel's
 * profile in the staff catalogue.
 */
function AccountSavedHotelRow({
  item,
  onPress,
}: {
  readonly item: SavedHotelStaffView;
  readonly onPress: () => void;
}) {
  const chip = savedHotelStatusChip(item.hotel);
  const note = savedHotelNote(item.note);
  const place = savedHotelPlace(item.hotel);
  return (
    <ListItem
      title={item.hotel.name}
      subtitle={note ? `${place} · ${note}` : place}
      meta={savedHotelDay(item.savedAt)}
      trailing={chip ? <StatusChip label={chip.label} tone={chip.tone} size="sm" /> : undefined}
      showChevron
      onPress={onPress}
      accessibilityLabel={savedHotelSummary(item)}
      testID={`account-saved-hotel-${item.id}`}
    />
  );
}

/** The loaded saves in one card, newest first, with a footer that loads the rest of the list. */
function SavedHotelList({
  saved,
  onOpen,
}: {
  readonly saved: CursorListResult<SavedHotelStaffView>;
  readonly onOpen: (hotelId: string) => void;
}) {
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {saved.items.map((item) => (
          <AccountSavedHotelRow key={item.id} item={item} onPress={() => onOpen(item.hotel.id)} />
        ))}
        <LoadMore
          hasMore={saved.hasMore}
          loading={saved.isLoadingMore}
          failed={saved.loadMoreError}
          onLoadMore={saved.loadMore}
          testID="account-saved-hotels-load-more"
        />
      </Stack>
    </Card>
  );
}

export interface AccountSavedHotelsProps {
  readonly accountId: string;
  /** Whether the reader may see clients' saved hotels (`hotels.saved_hotels.read`); no request otherwise. */
  readonly canRead: boolean;
}

/**
 * The hotels the client saved while exploring on their discovery subscription (TW-13 Hotels: "saved
 * hotels and enquiries"), newest first: what they are interested in before they ask for help with any.
 * Read-only; the client alone changes the list. Hidden for a role without the grant; a refused load
 * hides it too (SectionError), a failed one retries.
 */
export function AccountSavedHotels({ accountId, canRead }: AccountSavedHotelsProps) {
  const router = useRouter();
  const saved = useClientSavedHotels({ accountId }, { enabled: canRead });
  if (!canRead) return null;
  if (saved.isError) {
    return <SectionError title="Saved hotels" error={saved.error} onRetry={saved.refetch} />;
  }
  const openHotel = (hotelId: string): void =>
    router.push({ pathname: "/hotels-admin/[hotelId]/details", params: { hotelId } });
  return (
    <Stack gap={2} testID="account-saved-hotels">
      <Text variant="heading">
        {saved.isPending
          ? "Saved hotels"
          : savedHotelsCount("Saved hotels", saved.items.length, saved.hasMore)}
      </Text>
      {saved.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : saved.items.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No saved hotels yet. Hotels appear here as the client saves them while exploring.
        </Text>
      ) : (
        <SavedHotelList saved={saved} onOpen={openHotel} />
      )}
    </Stack>
  );
}
