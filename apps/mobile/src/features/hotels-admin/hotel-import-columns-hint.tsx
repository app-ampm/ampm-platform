import type { HotelImportKind } from "@ampm/core";
import { Button, Card, Row, Stack, Text } from "@ampm/ui";

import { importColumnsHint, importTemplateCsv } from "./hotel-import.format";
import { IMPORT_KIND_COPY, importTemplateFile } from "./hotel-import.kinds";
import { importRules } from "./hotel-import.rules";
import { useCsvDownload } from "./use-csv-download";

/**
 * A kind's template help (TW-25): its columns, the rules of its file one per line (list, enum,
 * capacity and layout cells, the units rule, the size and the 24 hours a preview keeps), and its
 * template to download, the header row alone, marked as UTF-8.
 *
 *   <ImportColumnsHint kind="venues" />
 */
export function ImportColumnsHint({ kind }: { readonly kind: HotelImportKind }) {
  const download = useCsvDownload();
  return (
    <Card padding="sm" testID="hotel-import-columns">
      <Stack gap={2}>
        <Text variant="label" tone="muted">
          {`${IMPORT_KIND_COPY[kind].label} CSV columns`}
        </Text>
        <Text variant="bodySmall" tone="primary" testID="hotel-import-columns-list">
          {importColumnsHint(kind)}
        </Text>
        <Stack gap={1} testID="hotel-import-rules">
          {importRules(kind).map((rule) => (
            <Text key={rule} variant="bodySmall" tone="muted">
              {rule}
            </Text>
          ))}
        </Stack>
        <Row gap={2} wrap>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onPress={() => download(importTemplateFile(kind), importTemplateCsv(kind))}
            testID="hotel-import-template"
          >
            Download template
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
