import { useHotelMedia } from "@ampm/api-client";
import { Card, Divider, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { consentOwedLabel, mediaRightsSummary, type MediaRightsLine } from "./media.format";

function RightsLine({ line }: { readonly line: MediaRightsLine }) {
  const owed = consentOwedLabel(line.needConsent);
  return (
    <Row gap={3} align="center" justify="between" testID={`media-rights-${line.kind}`}>
      <Text variant="bodySmall" tone="primary">{`${line.label} · ${line.count}`}</Text>
      {line.needConsent > 0 ? (
        <StatusChip label={owed} tone="warning" size="sm" />
      ) : (
        <Text variant="bodySmall" tone="body">
          {owed}
        </Text>
      )}
    </Row>
  );
}

/**
 * T5's media-rights panel: the hotel's photos and videos, and how many still need consent before
 * clients may see them (GP-20). Shown only when the hotel has media and the whole list has loaded, so
 * the counts are never those of a first page; a failed load leaves it out, the media page reports it.
 */
export function MediaRightsPanel({ hotelId }: { readonly hotelId: string }) {
  const media = useHotelMedia(hotelId);
  const complete = media.data && media.data.nextCursor === null ? media.data.items : [];
  const lines = mediaRightsSummary(complete);
  if (lines.length === 0) return null;
  return (
    <Card testID="rates-media-rights">
      <Stack gap={3}>
        <Text variant="subheading">Media rights</Text>
        {lines.map((line, index) => (
          <Stack key={line.kind} gap={3}>
            {index > 0 ? <Divider /> : null}
            <RightsLine line={line} />
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
