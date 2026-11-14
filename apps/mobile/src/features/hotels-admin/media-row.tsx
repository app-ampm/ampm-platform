import type { MediaAssetView } from "@ampm/core";
import { Row, Stack, Text } from "@ampm/ui";

import { MediaChips } from "./media-chips";
import { MediaItemActions } from "./media-item-actions";
import { MediaThumb } from "./media-thumb";
import { mediaName } from "./media.format";

export interface MediaRowProps {
  readonly media: MediaAssetView;
  readonly onEdit: (media: MediaAssetView) => void;
  readonly onDelete: (media: MediaAssetView) => void;
}

/** One asset in the manager on a phone: thumbnail, caption, its scan/visibility/rights chips, edit/delete. */
export function MediaRow({ media, onEdit, onDelete }: MediaRowProps) {
  return (
    <Row gap={3} align="center" justify="between" testID={`media-row-${media.id}`}>
      <Row gap={3} align="center" className="flex-1">
        <MediaThumb media={media} size="row" />
        <Stack gap={1} className="flex-1">
          <Text variant="body" numberOfLines={1}>
            {mediaName(media)}
          </Text>
          <MediaChips media={media} />
        </Stack>
      </Row>
      <MediaItemActions media={media} onEdit={onEdit} onDelete={onDelete} />
    </Row>
  );
}
