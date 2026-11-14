import { useState } from "react";
import { View } from "react-native";

import type { HotelVenueClientView } from "@ampm/core";
import { DataTable, Stack, Text, type DataTableColumn } from "@ampm/ui";

import { facilitiesLine, venueKindLine } from "./hotels.format";
import { venueSeatLines } from "./hotels.format.desktop";

function VenueCell({ venue }: { readonly venue: HotelVenueClientView }) {
  const facilities = facilitiesLine(venue.facilities);
  return (
    <Stack gap={1}>
      <Text variant="label" tone="primary">
        {venue.name}
      </Text>
      {venue.description ? (
        <Text variant="caption" tone="muted">
          {venue.description}
        </Text>
      ) : null}
      {facilities ? (
        <Text variant="caption" tone="muted">
          {facilities}
        </Text>
      ) : null}
    </Stack>
  );
}

function SeatsCell({ venue }: { readonly venue: HotelVenueClientView }) {
  const lines = venueSeatLines(venue);
  if (lines.length === 0)
    return (
      <Text variant="bodySmall" tone="muted">
        On request
      </Text>
    );
  return (
    <Stack gap={0} align="end">
      {lines.map((line) => (
        <Text key={line} variant="bodySmall" className="tabular-nums">
          {line}
        </Text>
      ))}
    </Stack>
  );
}

/**
 * D6's column shares are 1.4 : 1 : 0.8 : 1; the capacity is widened for its three seatings ("Reception
 * 1100" on one line from 1024) and the area, a short figure, narrowed.
 */
const SHARES = { venue: 1.3, type: 0.8, seats: 1.1, area: 0.7 } as const;
const SHARE_TOTAL = SHARES.venue + SHARES.type + SHARES.seats + SHARES.area;
/** Until the card is measured: the narrowest main column D6's layout gives (1024). */
const FALLBACK_WIDTH = 464;

/**
 * D6's columns, with what the client view carries: the hotel sends no rental per venue (venue rental is
 * a rate item, in the Rates card beside), so the last column is the floor area. A column that grows
 * would widen to its longest line instead of wrapping it, so every column takes its share of the
 * measured card width: the table fills the card, wraps its text and never scrolls.
 */
function venueColumns(width: number): DataTableColumn<HotelVenueClientView>[] {
  const share = (part: number) => Math.floor((width * part) / SHARE_TOTAL);
  return [
    {
      key: "venue",
      header: "Venue",
      width: share(SHARES.venue),
      render: (v) => <VenueCell venue={v} />,
    },
    {
      key: "type",
      header: "Type",
      width: share(SHARES.type),
      render: (v) => <Text variant="bodySmall">{venueKindLine(v)}</Text>,
    },
    {
      key: "seats",
      header: "Capacity",
      width: share(SHARES.seats),
      align: "end",
      render: (v) => <SeatsCell venue={v} />,
    },
    {
      key: "area",
      header: "Area",
      width: share(SHARES.area),
      align: "end",
      render: (v) => (
        <Text variant="bodySmall" className="tabular-nums">
          {v.areaSqm === null ? "—" : `${v.areaSqm} m²`}
        </Text>
      ),
    },
  ];
}

/** The venues as D6's table on a desktop (CP-05 "Venues"): name and notes, kind, seating, area. */
export function HotelVenueTable({ venues }: { readonly venues: readonly HotelVenueClientView[] }) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  return (
    <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}>
      <DataTable
        columns={venueColumns(width)}
        rows={venues}
        keyExtractor={(venue) => venue.id}
        testID="hotel-venue-table"
      />
    </View>
  );
}
