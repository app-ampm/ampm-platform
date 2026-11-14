import type { ReactNode } from "react";
import { View } from "react-native";

import type { HotelDetailView, MediaGalleryItem } from "@ampm/core";
import { Button, Columns, PhotoPlaceholder, Stack, type PhotoPlaceholderTone } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import { HotelBackButton } from "./hotel-hero";
import { galleryImages } from "./hotels.format";
import { mediaCountLabel } from "./hotels.format.desktop";

export interface HotelMosaicProps {
  readonly hotel: HotelDetailView;
  readonly onBack: () => void;
  /** Opens the gallery (or the videos) from the "All N photos" pill. */
  readonly onShowAll: () => void;
}

interface TileProps {
  readonly image: MediaGalleryItem | undefined;
  /** The stand-in's bands when there is no picture: D6 alternates gold and peacock. */
  readonly tone: PhotoPlaceholderTone;
  /** Floats over the tile's foot: the "All N photos" pill. */
  readonly overlay?: ReactNode;
}

/**
 * A small tile: the picture, or the striped stand-in. The stand-ins are decoration (the hero already
 * names the hotel's photo for screen readers), so they stay out of the accessibility tree.
 */
function SmallTile({ image, tone, overlay }: TileProps) {
  return (
    <View className="h-56 overflow-hidden rounded-lg border border-primary/14">
      {image ? (
        <MediaImage
          uri={image.webUrl}
          alt={image.caption ?? "Hotel photo"}
          radius="none"
          className="h-full w-full"
        />
      ) : (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-full w-full"
        >
          <PhotoPlaceholder
            label=""
            tone={tone}
            showLabel={false}
            className="h-full w-full rounded-none"
          />
        </View>
      )}
      {/* Absolute: the pill sits on the last tile's foot, as D6 draws it. */}
      {overlay ? <View className="absolute bottom-3 right-3">{overlay}</View> : null}
    </View>
  );
}

/** The large first tile, two rows tall, with the back button over its top-left corner. */
function HeroTile({ hotel, onBack }: Pick<HotelMosaicProps, "hotel" | "onBack">) {
  const photo = galleryImages(hotel)[0];
  return (
    <View className="flex-1 overflow-hidden rounded-xl border border-primary/14">
      {photo ? (
        <MediaImage
          uri={photo.webUrl}
          alt={photo.caption ?? `Photo of ${hotel.name}`}
          radius="none"
          className="h-full w-full"
        />
      ) : (
        <PhotoPlaceholder
          label={`Hotel photo · ${hotel.destination.name}`}
          showLabel={false}
          className="h-full w-full rounded-none"
        />
      )}
      {/* Absolute: the back button floats over the photo's corner, as on the phone (P4). */}
      <View className="absolute left-4 top-4">
        <HotelBackButton onPress={onBack} />
      </View>
    </View>
  );
}

/**
 * D6's photo mosaic across the page: the first picture in a 2fr tile two rows tall, the next four in
 * 1fr tiles beside it (column by column, as D6's grid flows them), 10 apart, with the striped stand-in
 * wherever the media library has no picture yet, and the photo and video count on the last tile.
 */
export function HotelMosaic({ hotel, onBack, onShowAll }: HotelMosaicProps) {
  const images = galleryImages(hotel);
  const count = mediaCountLabel(hotel);
  const pill = count ? (
    <Button variant="glass" size="sm" onPress={onShowAll}>
      {count}
    </Button>
  ) : null;
  return (
    <Columns ratios={[2, 1, 1]} gap={2.5} testID="hotel-mosaic">
      <HeroTile hotel={hotel} onBack={onBack} />
      <Stack gap={2.5}>
        <SmallTile image={images[1]} tone="peacock" />
        <SmallTile image={images[3]} tone="gold" />
      </Stack>
      <Stack gap={2.5}>
        <SmallTile image={images[2]} tone="gold" />
        <SmallTile image={images[4]} tone="peacock" overlay={pill} />
      </Stack>
    </Columns>
  );
}
