import type { HotelView } from "@ampm/core";
import { PhotoPlaceholder, type PhotoPlaceholderTone } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

export interface SavedHotelPhotoProps {
  readonly hotel: HotelView;
  /** Size and corners: the phone row's 48 × 40 thumbnail, or a desktop column's 130 tall photo. */
  readonly className: string;
  readonly tone?: PhotoPlaceholderTone | undefined;
}

/** A saved hotel's cover when it has a client-visible image, else the striped stand-in. */
export function SavedHotelPhoto({ hotel, className, tone }: SavedHotelPhotoProps) {
  return hotel.coverUrl ? (
    <MediaImage
      uri={hotel.coverUrl}
      alt={`Photo of ${hotel.name}`}
      radius="none"
      className={className}
    />
  ) : (
    <PhotoPlaceholder
      label={`Hotel photo · ${hotel.destination.name}`}
      showLabel={false}
      tone={tone}
      className={className}
    />
  );
}
