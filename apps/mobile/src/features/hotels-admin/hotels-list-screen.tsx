import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { useStaffHotels, type CursorListResult } from "@ampm/api-client";
import type { HotelStaffView } from "@ampm/core";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  LoadMore,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { hotelRowSummary } from "./hotels-admin.format";
import { useHotelColumns } from "./hotels-table.columns";
import { useClientInterestPermissions } from "./use-client-interest-permissions";
import { useDestinationPermissions } from "./use-destination-permissions";

type Hotels = CursorListResult<HotelStaffView>;

/** "Hotels · 12", with a "+" while more pages wait beyond the loaded ones. */
function hotelsEyebrow(hotels: Hotels): string {
  if (hotels.isPending || hotels.isError) return "Hotels";
  return `Hotels · ${hotels.items.length}${hotels.hasMore ? "+" : ""}`;
}

function HotelsLoading() {
  return (
    <Stack gap={2} testID="hotels-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

interface TableProps {
  readonly hotels: readonly HotelStaffView[];
  readonly onOpen: (hotel: HotelStaffView) => void;
}

/** The catalogue as a table in a glass panel: T4's columns from 1024, today's three below it. */
function HotelsTable({ hotels, onOpen }: TableProps) {
  const columns = useHotelColumns();
  return (
    // T4's table sits 26 in from its panel's sides on a desktop.
    <Card padding="sm" className="lg:px-6" testID="hotels-table">
      <DataTable
        columns={columns}
        rows={hotels}
        keyExtractor={(hotel) => hotel.id}
        onRowPress={onOpen}
        rowAccessibilityLabel={hotelRowSummary}
      />
    </Card>
  );
}

interface BodyProps {
  readonly hotels: Hotels;
  readonly onOpen: (hotel: HotelStaffView) => void;
}

/** The loaded hotels and, while more wait, the next-page footer (50 a page). */
function HotelsLoaded({ hotels, onOpen }: BodyProps) {
  return (
    <Stack gap={4}>
      <HotelsTable hotels={hotels.items} onOpen={onOpen} />
      <LoadMore
        hasMore={hotels.hasMore}
        loading={hotels.isLoadingMore}
        failed={hotels.loadMoreError}
        onLoadMore={hotels.loadMore}
        testID="hotels-load-more"
      />
    </Stack>
  );
}

function HotelsBody({ hotels, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (hotels.isPending) return <HotelsLoading />;
  if (hotels.isError) {
    return (
      <QueryErrorState
        error={hotels.error}
        onRetry={hotels.refetch}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view the hotel catalogue",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (hotels.items.length === 0) {
    return (
      <EmptyState
        icon="map"
        title="No hotels yet"
        description="Hotels appear here once they are added to the catalogue."
      />
    );
  }
  return <HotelsLoaded hotels={hotels} onOpen={onOpen} />;
}

/** The way to every client's saved hotels, for a role that may read them (glass, before the rest). */
function SavedByClientsLink({ onPress }: { readonly onPress: (() => void) | undefined }) {
  if (!onPress) return null;
  return (
    <Button
      variant="glass"
      size="sm"
      icon="heart"
      onPress={onPress}
      testID="hotels-saved-by-clients-link"
    >
      Saved by clients
    </Button>
  );
}

/**
 * The page's actions (T4): Destinations and Import on glass, then the gold New hotel; before them, for a
 * role that may read clients' saved hotels, the way to every client's saves on glass too.
 */
function HotelsActions({
  onOpenSaved,
  onOpenDestinations,
  onImport,
  onCreate,
}: {
  readonly onOpenSaved: (() => void) | undefined;
  readonly onOpenDestinations: () => void;
  readonly onImport: () => void;
  readonly onCreate: () => void;
}) {
  return (
    <>
      <SavedByClientsLink onPress={onOpenSaved} />
      <Button
        variant="glass"
        size="sm"
        icon="map-pin"
        onPress={onOpenDestinations}
        testID="hotel-destinations-link"
      >
        Destinations
      </Button>
      <Button variant="glass" size="sm" icon="upload" onPress={onImport} testID="hotel-import-link">
        Import
      </Button>
      <Button variant="primary" size="sm" icon="plus" onPress={onCreate} testID="hotel-new">
        New hotel
      </Button>
    </>
  );
}

/** The page's header (T4): eyebrow and title, with the actions beside them from 768. */
function HotelsHeader({
  eyebrow,
  onCreate,
}: {
  readonly eyebrow: string;
  readonly onCreate: () => void;
}) {
  const router = useRouter();
  const { canReadSavedHotels } = useClientInterestPermissions();
  return (
    <ScreenHeader
      eyebrow={eyebrow}
      title="Hotel catalogue"
      actions={
        <HotelsActions
          onOpenSaved={canReadSavedHotels ? () => router.push("/leads/saved-hotels") : undefined}
          onOpenDestinations={() => router.push("/hotels-admin/destinations")}
          onImport={() => router.push("/hotels-admin/import")}
          onCreate={onCreate}
        />
      }
    />
  );
}

export interface HotelsListScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel catalogue (H1.1, T4): the private hotel database. Add a hotel with "New hotel", bulk-load
 * many from a CSV with "Import", or tap one to manage it (edit its profile, add photos, rate cards). The
 * list loads 50 hotels a page, name-ordered, with "Load more" under the table while more wait; the eyebrow
 * counts the loaded ones ("Hotels · 50+"). From 1024 the table carries T4's verification and visibility
 * columns. "Saved by clients" opens every client's saved hotels, for a role that may read them. Hotel team
 * and Super Admin only, gated server-side.
 *
 *   <HotelsListScreen tabBar={<AppTabBar />} />
 */
export function HotelsListScreen({ tabBar }: HotelsListScreenProps) {
  const router = useRouter();
  const hotels = useStaffHotels();
  const [creating, setCreating] = useState(false);
  const { canCreate: canAddDestination } = useDestinationPermissions();
  const open = (hotel: HotelStaffView): void =>
    router.push({ pathname: "/hotels-admin/[hotelId]", params: { hotelId: hotel.id } });
  // From the New hotel form when no destination exists yet: close it, then add one on Destinations.
  const addDestination = (): void => {
    setCreating(false);
    router.push("/hotels-admin/destinations");
  };
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<HotelsHeader eyebrow={hotelsEyebrow(hotels)} onCreate={() => setCreating(true)} />}
    >
      <HotelsBody hotels={hotels} onOpen={open} />
      <HotelProfileEditSheet
        open={creating}
        hotel={null}
        onClose={() => setCreating(false)}
        onAddDestination={canAddDestination ? addDestination : undefined}
      />
    </Screen>
  );
}
