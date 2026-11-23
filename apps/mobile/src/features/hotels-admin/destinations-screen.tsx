import { useState, type ReactNode } from "react";
import { useCanGoBack, useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useStaffDestinations } from "@ampm/api-client";
import type { DestinationListItemView } from "@ampm/core";
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

import { DestinationEditSheet } from "./destination-edit-sheet";
import { destinationRowSummary } from "./destinations.format";
import { useDestinationColumns } from "./destinations-table.columns";
import { useDestinationPermissions } from "./use-destination-permissions";

/** The sheet's state: shut, adding a destination (null), or editing one. */
type Editing = { readonly open: false } | { readonly open: true; readonly destination: Row | null };
type Row = DestinationListItemView;

function DestinationsLoading() {
  return (
    <Stack gap={2} testID="destinations-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

/** The destinations in T4's table on a glass panel; a row opens its editor for a role that may edit. */
function DestinationsTable({
  destinations,
  onOpen,
}: {
  readonly destinations: readonly Row[];
  readonly onOpen: ((destination: Row) => void) | undefined;
}) {
  const columns = useDestinationColumns();
  return (
    <Card padding="sm" className="lg:px-6" testID="destinations-table">
      <DataTable
        columns={columns}
        rows={destinations}
        keyExtractor={(destination) => destination.id}
        onRowPress={onOpen}
        rowAccessibilityLabel={destinationRowSummary}
      />
    </Card>
  );
}

interface BodyProps {
  readonly destinations: UseQueryResult<Row[]>;
  readonly onAdd: (() => void) | undefined;
  readonly onOpen: ((destination: Row) => void) | undefined;
}

function DestinationsBody({ destinations, onAdd, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (destinations.isPending) return <DestinationsLoading />;
  if (destinations.isError) {
    return (
      <QueryErrorState
        error={destinations.error}
        onRetry={() => void destinations.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view the destinations",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (destinations.data.length === 0) {
    return (
      <EmptyState
        icon="map-pin"
        title="No destinations yet"
        description="Destinations group the catalogue by place. Add one, then file hotels under it."
        action={onAdd ? { label: "Add a destination", onPress: onAdd } : undefined}
        testID="destinations-empty"
      />
    );
  }
  return <DestinationsTable destinations={destinations.data} onOpen={onOpen} />;
}

/**
 * The page's header (T4): back to the hotel catalogue (or there, when opened straight from a link), and
 * the gold New destination for a role that may add one.
 */
function DestinationsHeader({ onAdd }: { readonly onAdd: (() => void) | undefined }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <ScreenHeader
      eyebrow="Hotels"
      title="Destinations"
      onBack={() => (canGoBack ? router.back() : router.replace("/hotels-admin"))}
      backLabel="Back to the hotel catalogue"
      actions={
        onAdd ? (
          <Button variant="primary" size="sm" icon="plus" onPress={onAdd} testID="destination-new">
            New destination
          </Button>
        ) : undefined
      }
    />
  );
}

export interface DestinationsScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The destination catalogue (TW-20, in T4's frame): every place a hotel can be filed under, with its
 * status, web address, place, website flag and how many hotels it holds. The Hotel team and Super Admin
 * add one with "New destination" and edit one from its row; every other role reads. Gated server-side.
 *
 *   <DestinationsScreen tabBar={<AppTabBar />} />
 */
export function DestinationsScreen({ tabBar }: DestinationsScreenProps) {
  const destinations = useStaffDestinations();
  const { canCreate, canUpdate } = useDestinationPermissions();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const add = canCreate ? () => setEditing({ open: true, destination: null }) : undefined;
  const open = canUpdate
    ? (destination: Row) => setEditing({ open: true, destination })
    : undefined;
  return (
    <Screen width="wide" tabBar={tabBar} header={<DestinationsHeader onAdd={add} />}>
      <DestinationsBody destinations={destinations} onAdd={add} onOpen={open} />
      <DestinationEditSheet
        open={editing.open}
        destination={editing.open ? editing.destination : null}
        onClose={() => setEditing({ open: false })}
      />
    </Screen>
  );
}
