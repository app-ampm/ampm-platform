import { View } from "react-native";

import type {
  HotelDetailView,
  HotelRoomClientView,
  HotelVenueClientView,
  MediaGalleryItem,
  WeddingReferenceClientItem,
} from "@ampm/core";
import { Icon, ListItem, Row, Stack, Text } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import { HotelRates } from "./hotel-rates";
import {
  facilitiesLine,
  galleryImages,
  roomMetaLine,
  venueCapacities,
  venueKindLine,
  type HotelSection,
} from "./hotels.format";

export interface HotelSectionBodyProps {
  readonly hotel: HotelDetailView;
  readonly section: HotelSection;
}

/** The content under the hotel page's tab strip, one section at a time. */
export function HotelSectionBody({ hotel, section }: HotelSectionBodyProps) {
  if (section === "overview") return <HotelOverview hotel={hotel} />;
  if (section === "venues") return <HotelVenues venues={hotel.venues} />;
  if (section === "rooms") return <HotelRooms rooms={hotel.rooms} />;
  if (section === "gallery") return <HotelGallery images={galleryImages(hotel)} />;
  if (section === "weddings") return <HotelWeddings references={hotel.references} />;
  return <HotelRates rates={hotel.rates} />;
}

function HotelOverview({ hotel }: { readonly hotel: HotelDetailView }) {
  return (
    <Stack gap={3}>
      {hotel.description ? <Text>{hotel.description}</Text> : null}
      {hotel.address ? (
        <Row gap={2} align="start">
          <Icon name="map-pin" size="sm" tone="muted" />
          <Text variant="bodySmall" tone="muted" className="flex-1">
            {hotel.address}
          </Text>
        </Row>
      ) : null}
    </Stack>
  );
}

/** The function/event spaces a client weighs (CP-05 "Venues"): kind, capacities, amenities. */
function HotelVenues({ venues }: { readonly venues: readonly HotelVenueClientView[] }) {
  return (
    <Stack gap={4}>
      {venues.map((venue) => (
        <VenueRow key={venue.id} venue={venue} />
      ))}
    </Stack>
  );
}

function VenueRow({ venue }: { readonly venue: HotelVenueClientView }) {
  const capacities = venueCapacities(venue);
  const facilities = facilitiesLine(venue.facilities);
  return (
    <Stack gap={1}>
      <Text variant="label" tone="primary">
        {venue.name}
      </Text>
      <Text variant="bodySmall" tone="muted">
        {venueKindLine(venue)}
      </Text>
      {capacities ? (
        <Row gap={2} align="start">
          <Icon name="users" size="sm" tone="muted" />
          <Text variant="bodySmall" className="flex-1">
            {capacities}
          </Text>
        </Row>
      ) : null}
      {venue.description ? (
        <Text variant="bodySmall" tone="muted">
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

/** The room categories a client weighs (CP-05 "Rooms"): count, occupancy, size, amenities. */
function HotelRooms({ rooms }: { readonly rooms: readonly HotelRoomClientView[] }) {
  return (
    <Stack gap={4}>
      {rooms.map((room) => (
        <RoomRow key={room.id} room={room} />
      ))}
    </Stack>
  );
}

function RoomRow({ room }: { readonly room: HotelRoomClientView }) {
  const meta = roomMetaLine(room);
  const facilities = facilitiesLine(room.facilities);
  return (
    <Stack gap={1}>
      <Text variant="label" tone="primary">
        {room.name}
      </Text>
      {meta ? (
        <Row gap={2} align="start">
          <Icon name="bed" size="sm" tone="muted" />
          <Text variant="bodySmall" className="flex-1">
            {meta}
          </Text>
        </Row>
      ) : null}
      {room.description ? (
        <Text variant="bodySmall" tone="muted">
          {room.description}
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

const COLUMNS = 3;

function rowsOf<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    rows.push(items.slice(start, start + size));
  return rows;
}

/** The client-visible pictures, three to a row; a short last row keeps the tiles their size. */
function HotelGallery({ images }: { readonly images: readonly MediaGalleryItem[] }) {
  return (
    <Stack gap={2}>
      {rowsOf(images, COLUMNS).map((row) => (
        <Row key={row[0]?.id} gap={2}>
          {row.map((item) => (
            <MediaImage
              key={item.id}
              uri={item.thumbnailUrl}
              alt={item.caption ?? "Hotel photo"}
              className="aspect-square flex-1"
            />
          ))}
          {Array.from({ length: COLUMNS - row.length }, (_, index) => (
            <View key={`space-${index}`} className="flex-1" />
          ))}
        </Row>
      ))}
    </Stack>
  );
}

/** Previous weddings at the hotel (D6 "Weddings here"), shown only with the family's consent (GP-20). */
function HotelWeddings({
  references,
}: {
  readonly references: readonly WeddingReferenceClientItem[];
}) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow">Shown with the family’s permission</Text>
      {references.map((reference) => (
        <ListItem
          key={reference.id}
          title={`Wedding in ${reference.eventYear}`}
          subtitle={reference.descriptionClient ?? undefined}
          meta={reference.guestCount === null ? undefined : `${reference.guestCount} guests`}
        />
      ))}
    </Stack>
  );
}
