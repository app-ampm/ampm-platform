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
  Text,
  useLayoutAt,
} from "@ampm/ui";

import {
  savedByClientSummary,
  savedByClientsHeading,
  savedHotelDay,
  savedHotelNote,
} from "../accounts/saved-hotels.format";

/** The loaded savers in one card, newest save first, with a footer that loads the rest. */
function SaverList({
  saved,
  onOpenClient,
}: {
  readonly saved: CursorListResult<SavedHotelStaffView>;
  readonly onOpenClient: ((accountId: string) => void) | undefined;
}) {
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {saved.items.map((item) => (
          <ListItem
            key={item.id}
            title={item.account.name}
            subtitle={savedHotelNote(item.note) ?? undefined}
            meta={savedHotelDay(item.savedAt)}
            showChevron={onOpenClient !== undefined}
            onPress={onOpenClient ? () => onOpenClient(item.account.id) : undefined}
            accessibilityLabel={savedByClientSummary(item)}
            testID={`hotel-saver-${item.id}`}
          />
        ))}
        <LoadMore
          hasMore={saved.hasMore}
          loading={saved.isLoadingMore}
          failed={saved.loadMoreError}
          onLoadMore={saved.loadMore}
          testID="hotel-savers-load-more"
        />
      </Stack>
    </Card>
  );
}

export interface HotelSavedByClientsProps {
  readonly hotelId: string;
  /** Whether the reader may see clients' saved hotels (`hotels.saved_hotels.read`); no request otherwise. */
  readonly canRead: boolean;
  /** Whether a row opens the client's hub (`crm.accounts.read`); the rows are plain text otherwise. */
  readonly canOpenClient: boolean;
}

/**
 * The clients who saved this hotel while exploring on their discovery subscription, newest first: how
 * much interest the hotel draws and from whom, with each client's note. A row opens the client's hub,
 * where their whole list sits beside their enquiries. Read-only; the clients alone change their lists.
 * Hidden for a role without the grant; a refused load hides it too (SectionError), a failed one retries.
 * In T5's side column from 1024 its title steps down to interface type, as the contacts' does.
 *
 *   <HotelSavedByClients hotelId={hotelId} canRead={canReadSavedHotels} canOpenClient={canOpenClient} />
 */
export function HotelSavedByClients({ hotelId, canRead, canOpenClient }: HotelSavedByClientsProps) {
  const router = useRouter();
  const isDesktop = useLayoutAt("lg");
  const saved = useClientSavedHotels({ hotelId }, { enabled: canRead });
  if (!canRead) return null;
  if (saved.isError) {
    return <SectionError title="Saved by clients" error={saved.error} onRetry={saved.refetch} />;
  }
  const openClient = (accountId: string): void =>
    router.push({ pathname: "/leads/accounts/[accountId]", params: { accountId } });
  return (
    <Stack gap={2} testID="hotel-saved-by-clients">
      <Text variant={isDesktop ? "subheading" : "heading"} accessibilityRole="header">
        {saved.isPending
          ? "Saved by clients"
          : savedByClientsHeading(saved.items.length, saved.hasMore)}
      </Text>
      {saved.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : saved.items.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          Clients appear here as they save this hotel while exploring on their subscription.
        </Text>
      ) : (
        <SaverList saved={saved} onOpenClient={canOpenClient ? openClient : undefined} />
      )}
    </Stack>
  );
}
