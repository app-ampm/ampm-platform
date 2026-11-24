import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import {
  useHotelInfoRequestsToReview,
  useStaffHotels,
  type CursorListResult,
  type HotelInfoRequestsToReview,
} from "@ampm/api-client";
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

import { InviteHotelSheet } from "../hotel-info-requests/invite-hotel-sheet";
import { useInfoRequestPermissions } from "../hotel-info-requests/use-info-request-permissions";
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

/** "Requests · 3 to review": submitted and in review, tests left out; "+" past a page of either. */
export function requestsLabel(toReview: HotelInfoRequestsToReview | undefined): string {
  if (!toReview) return "Requests";
  return `Requests · ${toReview.count}${toReview.isCapped ? "+" : ""} to review`;
}

/** The way to TW-99, with the count waiting for review, for a reader of requests (glass). */
function RequestsLink({ onPress }: { readonly onPress: (() => void) | undefined }) {
  const toReview = useHotelInfoRequestsToReview({ enabled: onPress !== undefined });
  if (!onPress) return null;
  return (
    <Button variant="glass" size="sm" icon="inbox" onPress={onPress} testID="hotel-requests-link">
      {requestsLabel(toReview.data)}
    </Button>
  );
}

interface ActionsProps {
  readonly onOpenRequests: (() => void) | undefined;
  readonly onOpenSaved: (() => void) | undefined;
  readonly onOpenDestinations: () => void;
  readonly onImport: () => void;
  readonly onInvite: (() => void) | undefined;
  readonly onCreate: () => void;
}

/**
 * The page's actions (T4): the information requests with their count to review, then Destinations and
 * Import on glass, Invite a new hotel in the secondary outline, and the one gold New hotel; before
 * Destinations, for a role that may read clients' saved hotels, the way to every client's saves.
 */
function HotelsActions(props: ActionsProps) {
  return (
    <>
      <RequestsLink onPress={props.onOpenRequests} />
      <SavedByClientsLink onPress={props.onOpenSaved} />
      <Button
        variant="glass"
        size="sm"
        icon="map-pin"
        onPress={props.onOpenDestinations}
        testID="hotel-destinations-link"
      >
        Destinations
      </Button>
      <Button
        variant="glass"
        size="sm"
        icon="upload"
        onPress={props.onImport}
        testID="hotel-import-link"
      >
        Import
      </Button>
      {props.onInvite ? (
        <Button
          variant="secondary"
          size="sm"
          icon="send"
          onPress={props.onInvite}
          testID="hotel-invite"
        >
          Invite a new hotel
        </Button>
      ) : null}
      <Button variant="primary" size="sm" icon="plus" onPress={props.onCreate} testID="hotel-new">
        New hotel
      </Button>
    </>
  );
}

/** The page's header (T4): eyebrow and title, with the actions beside them from 768. */
function HotelsHeader({
  eyebrow,
  onCreate,
  onInvite,
}: {
  readonly eyebrow: string;
  readonly onCreate: () => void;
  readonly onInvite: (() => void) | undefined;
}) {
  const router = useRouter();
  const { canReadSavedHotels } = useClientInterestPermissions();
  const { canRead: canReadRequests } = useInfoRequestPermissions();
  return (
    <ScreenHeader
      eyebrow={eyebrow}
      title="Hotel catalogue"
      actions={
        <HotelsActions
          onOpenRequests={canReadRequests ? () => router.push("/hotels-admin/requests") : undefined}
          onOpenSaved={canReadSavedHotels ? () => router.push("/leads/saved-hotels") : undefined}
          onOpenDestinations={() => router.push("/hotels-admin/destinations")}
          onImport={() => router.push("/hotels-admin/import")}
          onInvite={onInvite}
          onCreate={onCreate}
        />
      }
    />
  );
}

/**
 * The New hotel and Invite a new hotel sheets: whether each is open, Invite only for a role that may
 * create requests, the way from either to Destinations when there is none yet (closing it first), and
 * from a duplicate hint to that hotel's record, where its request panel is.
 */
function useCatalogueSheets() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { canCreate: canAddDestination } = useDestinationPermissions();
  const { canCreate: canInvite } = useInfoRequestPermissions();
  const addDestination = (): void => {
    setCreating(false);
    setInviting(false);
    router.push("/hotels-admin/destinations");
  };
  return {
    creating,
    setCreating,
    inviting,
    setInviting,
    onInvite: canInvite ? () => setInviting(true) : undefined,
    onAddDestination: canAddDestination ? addDestination : undefined,
    openDetails: (hotelId: string): void =>
      router.push({ pathname: "/hotels-admin/[hotelId]/details", params: { hotelId } }),
  };
}

export interface HotelsListScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel catalogue (H1.1, T4): the private hotel database. Add a hotel with "New hotel", bulk-load
 * many from a CSV with "Import", ask a hotel the catalogue does not hold yet for its details with "Invite
 * a new hotel" (D-188 §7), follow the information requests ("Requests · N to review", TW-99), or tap
 * one to manage it (edit its profile, add photos, rate cards). The
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
  const sheets = useCatalogueSheets();
  const open = (hotel: HotelStaffView): void =>
    router.push({ pathname: "/hotels-admin/[hotelId]", params: { hotelId: hotel.id } });
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <HotelsHeader
          eyebrow={hotelsEyebrow(hotels)}
          onCreate={() => sheets.setCreating(true)}
          onInvite={sheets.onInvite}
        />
      }
    >
      <HotelsBody hotels={hotels} onOpen={open} />
      <HotelProfileEditSheet
        open={sheets.creating}
        hotel={null}
        onClose={() => sheets.setCreating(false)}
        onAddDestination={sheets.onAddDestination}
      />
      <InviteHotelSheet
        open={sheets.inviting}
        onClose={() => sheets.setInviting(false)}
        onOpenHotel={sheets.openDetails}
        onAddDestination={sheets.onAddDestination}
      />
    </Screen>
  );
}
