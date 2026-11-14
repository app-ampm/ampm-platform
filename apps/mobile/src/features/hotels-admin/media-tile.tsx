import { Card, Row, Stack, Text } from "@ampm/ui";

import { MediaChips } from "./media-chips";
import { MediaItemActions } from "./media-item-actions";
import type { MediaRowProps } from "./media-row";
import { MediaThumb } from "./media-thumb";
import { mediaName } from "./media.format";

/**
 * One asset as a grid tile (from 768): the thumbnail across the tile, its name on a line of its own (a
 * tile three across a tablet is too narrow to share it), its chips, then edit and delete. A flat tint,
 * because the tiles sit inside the media panel's glass; it fills its cell, so a row of tiles lines up.
 */
export function MediaTile({ media, onEdit, onDelete }: MediaRowProps) {
  return (
    <Card tone="flat" padding="sm" className="flex-1" testID={`media-tile-${media.id}`}>
      <Stack gap={3}>
        <MediaThumb media={media} size="tile" />
        <Text variant="body" numberOfLines={1}>
          {mediaName(media)}
        </Text>
        <MediaChips media={media} />
        <Row justify="end">
          <MediaItemActions media={media} onEdit={onEdit} onDelete={onDelete} />
        </Row>
      </Stack>
    </Card>
  );
}
