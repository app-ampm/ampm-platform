import type { MediaAssetView } from "@ampm/core";
import { Button, Row } from "@ampm/ui";

import { mediaName } from "./media.format";

export interface MediaItemActionsProps {
  readonly media: MediaAssetView;
  readonly onEdit: (media: MediaAssetView) => void;
  readonly onDelete: (media: MediaAssetView) => void;
}

/** Edit and delete for one photo or video, named after it for screen readers. */
export function MediaItemActions({ media, onEdit, onDelete }: MediaItemActionsProps) {
  const name = mediaName(media);
  return (
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
  );
}
