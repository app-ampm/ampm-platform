import { View } from "react-native";

import { useMediaDownloadUrl } from "@ampm/api-client";
import type { MediaAssetView } from "@ampm/core";
import { cn, Icon } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

/** row: the 64 square beside a row's text · tile: the full width of a grid tile, at 16:9. */
export type MediaThumbSize = "row" | "tile";

const SIZE_CLASS: Record<MediaThumbSize, string> = {
  row: "h-16 w-16",
  tile: "aspect-video w-full",
};

export interface MediaThumbProps {
  readonly media: MediaAssetView;
  readonly size: MediaThumbSize;
}

/** The thumbnail: a signed link for a scanned-clean photo, or a status-coloured placeholder otherwise. */
export function MediaThumb({ media, size }: MediaThumbProps) {
  const isVideo = media.kind === "video";
  const clean = media.scanStatus === "clean";
  // A download URL is minted only for a clean asset; a video has no thumbnail derivative (that download is a
  // 404), so only an image mints a preview — a video keeps the film placeholder.
  const link = useMediaDownloadUrl(media.id, "thumbnail", clean && !isVideo);
  if (clean && !isVideo && link.data) {
    return (
      <MediaImage
        uri={link.data.url}
        alt={media.caption ?? ""}
        className={SIZE_CLASS[size]}
        radius="md"
        testID={`media-thumb-${media.id}`}
      />
    );
  }
  const placeholder = media.scanStatus === "rejected" ? "x-circle" : isVideo ? "video" : "image";
  return (
    <View
      className={cn("items-center justify-center rounded-md bg-primary/6", SIZE_CLASS[size])}
      testID={`media-thumb-${media.id}`}
    >
      <Icon name={placeholder} tone="muted" label={isVideo ? "Video" : undefined} />
    </View>
  );
}
