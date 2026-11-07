import type { ReactNode } from "react";
import { View } from "react-native";

import type { HotelDetailView } from "@ampm/core";
import { Button, Image, PhotoPlaceholder, uiCopy } from "@ampm/ui";

import { galleryImages } from "./hotels.format";

/** The circular glass back button of the hotel page (P4). */
export function HotelBackButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button
      variant="glass"
      icon="arrow-left"
      accessibilityLabel={uiCopy.screenHeader.back}
      onPress={onPress}
    />
  );
}

export interface HotelHeroFrameProps {
  readonly onBack: () => void;
  /** A round glass action for the top-right corner: the save heart (P4). */
  readonly trailing?: ReactNode;
  /** The picture, its stand-in, or a skeleton while the hotel loads: it fills the frame. */
  readonly children: ReactNode;
}

/**
 * The hero's frame: 288 tall on a phone, 384 from a tablet, with the back button over its top-left
 * corner and an optional action over the top-right one.
 */
export function HotelHeroFrame({ onBack, trailing, children }: HotelHeroFrameProps) {
  return (
    <View className="h-72 overflow-hidden rounded-lg md:h-96 md:rounded-xl">
      {children}
      {/* Absolute: the buttons float over the photo's top corners, as P4 draws them. */}
      <View className="absolute left-3 top-3">
        <HotelBackButton onPress={onBack} />
      </View>
      {trailing ? <View className="absolute right-3 top-3">{trailing}</View> : null}
    </View>
  );
}

export interface HotelHeroProps {
  readonly hotel: HotelDetailView;
  readonly onBack: () => void;
  /** The action over the photo's top-right corner, if the page has one there. */
  readonly trailing?: ReactNode;
}

/**
 * The top of the hotel page (D6, P4): the gallery's first picture, or the striped stand-in until the
 * media library has one. The stand-in's caption would sit under the back button, so it stays unseen
 * and only names the picture for screen readers.
 */
export function HotelHero({ hotel, onBack, trailing }: HotelHeroProps) {
  const photo = galleryImages(hotel)[0];
  return (
    <HotelHeroFrame onBack={onBack} trailing={trailing}>
      {photo ? (
        <Image
          source={{ uri: photo.webUrl }}
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
    </HotelHeroFrame>
  );
}
