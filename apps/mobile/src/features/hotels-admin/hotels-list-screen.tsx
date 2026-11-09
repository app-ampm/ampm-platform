import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useStaffHotels } from "@ampm/api-client";
import type { HotelStaffPage, HotelStaffView } from "@ampm/core";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  type DataTableColumn,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { hotelRowSummary, hotelStatusLabel, hotelStatusTone } from "./hotels-admin.format";

const COLUMNS: DataTableColumn<HotelStaffView>[] = [
  {
    key: "name",
    header: "Hotel",
    width: 240,
    render: (hotel) => (
      <Text variant="body" numberOfLines={1}>
        {hotel.name}
      </Text>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: 120,
    render: (hotel) => (
      <StatusChip
        label={hotelStatusLabel(hotel.status)}
        tone={hotelStatusTone(hotel.status)}
        size="sm"
      />
    ),
  },
  {
    key: "rooms",
    header: "Rooms",
    width: 100,
    align: "end",
    render: (hotel) => <Text variant="data">{hotel.totalRooms ?? "—"}</Text>,
  },
];

function HotelsLoading() {
  return (
    <Stack gap={2} testID="hotels-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

function HotelsBody({
  hotels,
  onOpen,
}: {
  readonly hotels: UseQueryResult<HotelStaffPage>;
  readonly onOpen: (hotel: HotelStaffView) => void;
}) {
  const goToSignIn = useGoToSignIn();
  if (hotels.isPending) return <HotelsLoading />;
  if (hotels.isError) {
    return (
      <QueryErrorState
        error={hotels.error}
        onRetry={() => void hotels.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view the hotel catalogue",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (hotels.data.items.length === 0) {
    return (
      <EmptyState
        icon="map"
        title="No hotels yet"
        description="Hotels appear here once they are added to the catalogue."
      />
    );
  }
  return (
    <Card padding="sm" testID="hotels-table">
      <DataTable
        columns={COLUMNS}
        rows={hotels.data.items}
        keyExtractor={(hotel) => hotel.id}
        onRowPress={onOpen}
        rowAccessibilityLabel={hotelRowSummary}
      />
    </Card>
  );
}

export interface HotelsListScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel catalogue (H1.1): the private hotel database. Add a hotel with "New hotel", bulk-load
 * many from a CSV with "Import", or tap one to manage it (edit its profile, add photos, rate cards). Hotel
 * team and Super Admin only, gated server-side.
 *
 *   <HotelsListScreen tabBar={<AppTabBar />} />
 */
export function HotelsListScreen({ tabBar }: HotelsListScreenProps) {
  const router = useRouter();
  const hotels = useStaffHotels();
  const [creating, setCreating] = useState(false);
  const open = (hotel: HotelStaffView): void =>
    router.push({ pathname: "/hotels-admin/[hotelId]", params: { hotelId: hotel.id } });
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow="Hotels"
          title="Hotel catalogue"
          trailing={
            <Row gap={2}>
              <Button
                variant="secondary"
                size="sm"
                icon="upload"
                onPress={() => router.push("/hotels-admin/import")}
                testID="hotel-import-link"
              >
                Import
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                onPress={() => setCreating(true)}
                testID="hotel-new"
              >
                New hotel
              </Button>
            </Row>
          }
        />
      }
    >
      <HotelsBody hotels={hotels} onOpen={open} />
      <HotelProfileEditSheet open={creating} hotel={null} onClose={() => setCreating(false)} />
    </Screen>
  );
}
