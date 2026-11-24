import { documentTypeLabel, HOTEL_DOCUMENT_TYPES } from "@ampm/core";
import { Card, Divider, Stack, Text } from "@ampm/ui";

import { documentCount, documentTypeTakes } from "./hotel-documents.format";
import { InternalHint } from "./subresource-section";

export interface DocumentsGuidePanelProps {
  /** How many documents the hotel holds, once the list has loaded. */
  readonly count: number | undefined;
}

/**
 * T5's side column beside the documents: what each type takes, as the upload checks it (D-187 §3), that
 * Word files are refused, and that the library is internal, opened through 15-minute links, and how
 * close the hotel is to its 100 documents.
 */
export function DocumentsGuidePanel({ count }: DocumentsGuidePanelProps) {
  return (
    <Card testID="documents-guide">
      <Stack gap={3}>
        <Text variant="subheading" accessibilityRole="header">
          What each type takes
        </Text>
        {HOTEL_DOCUMENT_TYPES.map((type) => (
          <Stack key={type} gap={1}>
            <Text variant="bodySmall" tone="primary">
              {documentTypeLabel(type)}
            </Text>
            <Text variant="bodySmall" tone="muted">
              {documentTypeTakes(type)}
            </Text>
          </Stack>
        ))}
        <Text variant="bodySmall" tone="body">
          Word files are not taken: save them as a PDF first.
        </Text>
        <Divider />
        <InternalHint text="Internal · never shown to clients" testID="documents-internal" />
        <Text variant="bodySmall" tone="muted">
          Open gives a link that works for 15 minutes; Office files download.
        </Text>
        {count !== undefined ? (
          <Text variant="bodySmall" tone="muted" testID="documents-count">
            {documentCount(count)}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
