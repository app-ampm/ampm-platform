import type { DestinationListItemView } from "@ampm/core";
import { StatusChip, Stack, Text, useLayoutAt, type DataTableColumn } from "@ampm/ui";

import { destinationPlace } from "./destinations.format";
import { hotelStatusLabel, hotelStatusTone, yesNo } from "./hotels-admin.format";

/*
 * The Destinations table (TW-20, in T4's table): below 1024 the name carries the place under it, with
 * the status and hotel count beside it; from 1024 the web address, the place and the website flag get
 * columns of their own. The web address is what the hotel import's destinationSlug column matches.
 */

type Column = DataTableColumn<DestinationListItemView>;

/** The name with its place under it, for the narrow table. */
const NAME_WITH_PLACE: Column = {
  key: "name",
  header: "Destination",
  width: 220,
  grow: true,
  render: (destination) => (
    <Stack gap={1}>
      <Text variant="body" numberOfLines={1}>
        {destination.name}
      </Text>
      <Text variant="bodySmall" tone="muted" numberOfLines={1}>
        {destinationPlace(destination)}
      </Text>
    </Stack>
  ),
};

const NAME: Column = {
  key: "name",
  header: "Destination",
  width: 180,
  grow: true,
  render: (destination) => (
    <Text variant="body" numberOfLines={1}>
      {destination.name}
    </Text>
  ),
};

const SLUG: Column = {
  key: "slug",
  header: "Web address",
  width: 150,
  render: (destination) => (
    <Text variant="data" numberOfLines={1}>
      {destination.slug}
    </Text>
  ),
};

const PLACE: Column = {
  key: "place",
  header: "Place",
  width: 190,
  render: (destination) => (
    <Text variant="bodySmall" numberOfLines={1}>
      {destinationPlace(destination)}
    </Text>
  ),
};

const STATUS: Column = {
  key: "status",
  header: "Status",
  width: 110,
  render: (destination) => (
    <StatusChip
      label={hotelStatusLabel(destination.status)}
      tone={hotelStatusTone(destination.status)}
      size="sm"
    />
  ),
};

const HOTELS: Column = {
  key: "hotels",
  header: "Hotels",
  width: 80,
  align: "end",
  render: (destination) => <Text variant="data">{destination.hotelCount}</Text>,
};

const PUBLIC: Column = {
  key: "public",
  header: "Website",
  width: 90,
  render: (destination) => (
    <Text variant="bodySmall" tone={destination.publicVisible ? "primary" : "muted"}>
      {yesNo(destination.publicVisible)}
    </Text>
  ),
};

/** Below 1024: the name and place, the status, the hotel count. */
export const DESTINATION_COLUMNS: readonly Column[] = [NAME_WITH_PLACE, STATUS, HOTELS];

/** From 1024: every field the list carries, each in its own column. */
export const DESTINATION_DESKTOP_COLUMNS: readonly Column[] = [
  NAME,
  SLUG,
  PLACE,
  STATUS,
  HOTELS,
  PUBLIC,
];

/** The columns for this window: six from 1024, three below it. */
export function useDestinationColumns(): readonly Column[] {
  return useLayoutAt("lg") ? DESTINATION_DESKTOP_COLUMNS : DESTINATION_COLUMNS;
}
