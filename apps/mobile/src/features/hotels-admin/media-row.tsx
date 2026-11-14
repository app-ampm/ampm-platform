import { View } from "react-native";

import { useMediaDownloadUrl } from "@ampm/api-client";
import type { MediaAssetView } from "@ampm/core";
import { Button, Icon, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import {
  rightsLabel,
  rightsTone,
  scanStatusLabel,
  scanStatusTone,
  visibilityLabel,
  visibilityTone,
} from "./media.format";

/** The thumbnail: a signed link for a scanned-clean photo, or a status-coloured placeholder otherwise. */
function MediaThumb({ media }: { readonly media: MediaAssetView }) {
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
        className="h-16 w-16"
        radius="md"
        testID={`media-thumb-${media.id}`}
      />
    );
  }
  const placeholder = media.scanStatus === "rejected" ? "x-circle" : isVideo ? "video" : "image";
  return (
    <View
      className="h-16 w-16 items-center justify-center rounded-md bg-primary/6"
      testID={`media-thumb-${media.id}`}
    >
      <Icon name={placeholder} tone="muted" label={isVideo ? "Video" : undefined} />
    </View>
  );
}

export interface MediaRowProps {
  readonly media: MediaAssetView;
  readonly onEdit: (media: MediaAssetView) => void;
  readonly onDelete: (media: MediaAssetView) => void;
}

/** One asset in the manager: thumbnail, caption, its scan/visibility/rights chips, and edit/delete. */
export function MediaRow({ media, onEdit, onDelete }: MediaRowProps) {
  const name = media.caption ?? (media.kind === "video" ? "Untitled video" : "Untitled photo");
  return (
    <Row gap={3} align="center" justify="between">
      <Row gap={3} align="center" className="flex-1">
        <MediaThumb media={media} />
        <Stack gap={1} className="flex-1">
          <Text variant="body" numberOfLines={1}>
            {name}
          </Text>
          <Row gap={1} wrap>
            <StatusChip
              label={scanStatusLabel(media.scanStatus)}
              tone={scanStatusTone(media.scanStatus)}
              size="sm"
            />
            <StatusChip
              label={visibilityLabel(media.visibility)}
              tone={visibilityTone(media.visibility)}
              size="sm"
            />
            <StatusChip
              label={rightsLabel(media.rightsStatus)}
              tone={rightsTone(media.rightsStatus)}
              size="sm"
            />
          </Row>
        </Stack>
      </Row>
      <Row gap={1}>
        <Button
          variant="ghost"
          size="sm"
          icon="edit"
          accessibilityLabel={`Edit ${name}`}
          onPress={() => onEdit(media)}
          testID={`media-edit-${media.id}`}
        />
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          accessibilityLabel={`Delete ${name}`}
          onPress={() => onDelete(media)}
          testID={`media-delete-${media.id}`}
        />
      </Row>
    </Row>
  );
}
