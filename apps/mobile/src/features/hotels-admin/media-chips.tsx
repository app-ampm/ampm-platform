import type { MediaAssetView } from "@ampm/core";
import { Row, StatusChip } from "@ampm/ui";

import {
  rightsLabel,
  rightsTone,
  scanStatusLabel,
  scanStatusTone,
  visibilityLabel,
  visibilityTone,
} from "./media.format";

/** A photo or video's scan, who-can-see-it and rights, as chips that wrap. */
export function MediaChips({ media }: { readonly media: MediaAssetView }) {
  return (
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
  );
}
