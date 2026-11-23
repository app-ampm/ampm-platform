import type { HotelImportResult } from "@ampm/core";
import { Button, Callout, Card, Stack, Text } from "@ampm/ui";

import {
  changingHeadline,
  changingRows,
  hasRejections,
  IMPORT_REPORT_FILE,
  IMPORT_ROWS_SHOWN,
  importReportCsv,
  importSummary,
  moreRowsText,
  rejectedHeadline,
  rejectedRowText,
  rowOutcomeText,
} from "./hotel-import.format";
import { useCsvDownload } from "./use-csv-download";

interface RowLine {
  readonly testID: string;
  readonly text: string;
}

/** A labelled block of row lines, capped on screen; the downloaded report lists them all. */
function RowBlock({ headline, lines }: { readonly headline: string; readonly lines: RowLine[] }) {
  const more = moreRowsText(lines.length);
  return (
    <Stack gap={1}>
      <Text variant="label" tone="muted">
        {headline}
      </Text>
      {lines.slice(0, IMPORT_ROWS_SHOWN).map((line) => (
        <Text key={line.testID} variant="bodySmall" tone="primary" testID={line.testID}>
          {line.text}
        </Text>
      ))}
      {more ? (
        <Text variant="bodySmall" tone="muted">
          {more}
        </Text>
      ) : null}
    </Stack>
  );
}

/** The rows that add or update a hotel, each with the columns it changes (never their values). */
function ChangingRows({ result }: { readonly result: HotelImportResult }) {
  const headline = changingHeadline(result);
  if (!headline) return null;
  const lines = changingRows(result).map((row) => ({
    testID: `hotel-import-row-${row.line}`,
    text: rowOutcomeText(row),
  }));
  return <RowBlock headline={headline} lines={lines} />;
}

/** The rejected rows, each named by line and field. */
function RejectedRows({ result }: { readonly result: HotelImportResult }) {
  const headline = rejectedHeadline(result);
  if (!headline) return null;
  const lines = result.rejected.map((row) => ({
    testID: `hotel-import-rejected-${row.line}`,
    text: rejectedRowText(row),
  }));
  return <RowBlock headline={headline} lines={lines} />;
}

export interface ImportResultPanelProps {
  readonly result: HotelImportResult;
  /** The CSV has changed since this run, so the report is of the CSV as it was before. */
  readonly isStale: boolean;
}

/**
 * The outcome of a validate or an import (TW-25): a summary callout, the rows that add or update a
 * hotel with the columns each changes, the rejected rows with their reasons (each list capped on
 * screen), and the whole per-row report as a CSV to download, so staff fix the rejected rows in their
 * spreadsheet. Unchanged rows are counted, not listed. Once the CSV changes, it says the report is of
 * the CSV as it was, and stays on screen while staff fix the rows it names.
 *
 *   {result ? <ImportResultPanel result={result} isStale={isStale} /> : null}
 */
export function ImportResultPanel({ result, isStale }: ImportResultPanelProps) {
  const download = useCsvDownload();
  return (
    <Card testID="hotel-import-result">
      <Stack gap={3}>
        {isStale ? (
          <Text variant="bodySmall" tone="muted" testID="hotel-import-result-stale">
            This report is of the CSV as it was before your last change. Validate again to check it
            as it is now.
          </Text>
        ) : null}
        <Callout
          kind={hasRejections(result) ? "warning" : "success"}
          title={importSummary(result)}
          blur={false}
        />
        <ChangingRows result={result} />
        <RejectedRows result={result} />
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          onPress={() => download(IMPORT_REPORT_FILE, importReportCsv(result))}
          testID="hotel-import-report"
        >
          {hasRejections(result) ? "Download error report" : "Download report"}
        </Button>
      </Stack>
    </Card>
  );
}
