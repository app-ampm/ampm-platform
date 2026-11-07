import { View } from "react-native";

import type { HotelDetailView, MediaGalleryItem, WeddingReferenceClientItem } from "@ampm/core";
import { Icon, Image, ListItem, Row, Stack, Text } from "@ampm/ui";

import { HotelRates } from "./hotel-rates";
import { galleryImages, type HotelSection } from "./hotels.format";

export interface HotelSectionBodyProps {
  readonly hotel: HotelDetailView;
  readonly section: HotelSection;
}

/** The content under the hotel page's tab strip, one section at a time. */
export function HotelSectionBody({ hotel, section }: HotelSectionBodyProps) {
  if (section === "overview") return <HotelOverview hotel={hotel} />;
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
            <Image
              key={item.id}
              source={{ uri: item.thumbnailUrl }}
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
