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
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { hotelRowSummary } from "./hotels-admin.format";
import { useHotelColumns } from "./hotels-table.columns";

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
  return <HotelsTable hotels={hotels.data.items} onOpen={onOpen} />;
}

/** The page's actions (T4): Import on glass, then the gold New hotel. */
function HotelsActions({
  onImport,
  onCreate,
}: {
  readonly onImport: () => void;
  readonly onCreate: () => void;
}) {
  return (
    <>
      <Button variant="glass" size="sm" icon="upload" onPress={onImport} testID="hotel-import-link">
        Import
      </Button>
      <Button variant="primary" size="sm" icon="plus" onPress={onCreate} testID="hotel-new">
        New hotel
      </Button>
    </>
  );
}

export interface HotelsListScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel catalogue (H1.1, T4): the private hotel database. Add a hotel with "New hotel", bulk-load
 * many from a CSV with "Import", or tap one to manage it (edit its profile, add photos, rate cards). From
 * 1024 the table carries T4's verification and visibility columns. Hotel team and Super Admin only, gated
 * server-side.
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
          actions={
            <HotelsActions
              onImport={() => router.push("/hotels-admin/import")}
              onCreate={() => setCreating(true)}
            />
          }
        />
      }
    >
      <HotelsBody hotels={hotels} onOpen={open} />
      <HotelProfileEditSheet open={creating} hotel={null} onClose={() => setCreating(false)} />
    </Screen>
  );
}
