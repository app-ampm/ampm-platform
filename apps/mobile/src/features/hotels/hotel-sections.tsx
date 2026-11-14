import { View } from "react-native";

import { useMediaUrl } from "@ampm/api-client";
import type {
  HotelDetailView,
  HotelRoomClientView,
  HotelVenueClientView,
  MediaGalleryItem,
  MediaVideoItem,
  WeddingReferenceClientItem,
} from "@ampm/core";
import { Icon, ListItem, Row, Stack, Text, Video } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import { HotelFacilities } from "./hotel-facilities";
import { HotelLocation } from "./hotel-location";
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
  if (section === "video") return <HotelVideos videos={hotel.videos} />;
  if (section === "weddings") return <HotelWeddings references={hotel.references} />;
  return <HotelRates rates={hotel.rates} />;
}

function HotelOverview({ hotel }: { readonly hotel: HotelDetailView }) {
  return (
    <Stack gap={3}>
      {hotel.description ? <Text>{hotel.description}</Text> : null}
      <HotelFacilities hotel={hotel} />
      <HotelLocation hotel={hotel} />
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

/** The client-visible videos (feature 9.3c): each plays inline with the platform's own controls. */
function HotelVideos({ videos }: { readonly videos: readonly MediaVideoItem[] }) {
  return (
    <Stack gap={3}>
      {videos.map((video) => (
        <HotelVideo key={video.id} video={video} />
      ))}
    </Stack>
  );
}

/**
 * One video: its signed URL resolved against the API base (the MediaImage rule), then the shared player, with
 * the caption shown as visible text beneath it. The visible caption is what conveys it on the web export —
 * there expo-video's `<video>` drops the accessibility label — so sighted and screen-reader clients both read
 * it; the player keeps the label as its own name on native (and a generic one when there is no caption).
 */
function HotelVideo({ video }: { readonly video: MediaVideoItem }) {
  const resolveMediaUrl = useMediaUrl();
  const source = resolveMediaUrl(video.url);
  if (!source) return null;
  return (
    <Stack gap={1}>
      <Video
        source={source}
        label={video.caption ?? "Hotel video"}
        className="aspect-video w-full"
        radius="lg"
      />
      {video.caption ? (
        <Text variant="bodySmall" tone="muted">
          {video.caption}
        </Text>
      ) : null}
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
