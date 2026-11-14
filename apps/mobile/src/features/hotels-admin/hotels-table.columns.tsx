import { formatDay, type HotelStaffView } from "@ampm/core";
import { StatusChip, Text, useLayoutAt, type DataTableColumn } from "@ampm/ui";

import { hotelStatusLabel, hotelStatusTone, yesNo } from "./hotels-admin.format";

/*
 * The catalogue's columns (T4). Below 1024 the table keeps the three it has always had, which already
 * scroll sideways on a phone; from 1024 it adds what the staff list view carries of T4's: the last
 * verification and whether the hotel is in the public showcase or demo. T4's destination, pax, rates and
 * media-rights columns need fields the list view does not carry.
 */

const NAME: DataTableColumn<HotelStaffView> = {
  key: "name",
  header: "Hotel",
  width: 240,
  grow: true,
  render: (hotel) => (
    <Text variant="body" numberOfLines={1}>
      {hotel.name}
    </Text>
  ),
};

const STATUS: DataTableColumn<HotelStaffView> = {
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
};

const ROOMS: DataTableColumn<HotelStaffView> = {
  key: "rooms",
  header: "Rooms",
  width: 100,
  align: "end",
  render: (hotel) => <Text variant="data">{hotel.totalRooms ?? "—"}</Text>,
};

const LAST_VERIFIED: DataTableColumn<HotelStaffView> = {
  key: "lastVerified",
  header: "Last verified",
  width: 130,
  render: (hotel) =>
    hotel.lastVerifiedAt ? (
      <Text variant="data">{formatDay(hotel.lastVerifiedAt, { style: "data" })}</Text>
    ) : (
      <Text variant="bodySmall" tone="muted">
        Not yet
      </Text>
    ),
};

function flagColumn(
  key: string,
  header: string,
  flagOf: (hotel: HotelStaffView) => boolean,
): DataTableColumn<HotelStaffView> {
  return {
    key,
    header,
    width: 80,
    render: (hotel) => (
      <Text variant="bodySmall" tone={flagOf(hotel) ? "primary" : "muted"}>
        {yesNo(flagOf(hotel))}
      </Text>
    ),
  };
}

/** Today's three columns, which scroll sideways on a phone. */
export const HOTEL_COLUMNS: readonly DataTableColumn<HotelStaffView>[] = [NAME, STATUS, ROOMS];

/** T4's desktop table: narrower fixed columns so all six fit beside the rail at 1024. */
export const HOTEL_DESKTOP_COLUMNS: readonly DataTableColumn<HotelStaffView>[] = [
  { ...NAME, width: 200 },
  { ...STATUS, width: 110 },
  { ...ROOMS, width: 80 },
  LAST_VERIFIED,
  flagColumn("public", "Public", (hotel) => hotel.publicShowcase),
  flagColumn("demo", "Demo", (hotel) => hotel.demoVisible),
];

/** The columns for this window: T4's six from 1024, today's three below it. */
export function useHotelColumns(): readonly DataTableColumn<HotelStaffView>[] {
  return useLayoutAt("lg") ? HOTEL_DESKTOP_COLUMNS : HOTEL_COLUMNS;
}
