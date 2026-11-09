import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { useHotelImport } from "@ampm/api-client";
import { isAppError, type HotelImportResult } from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  Input,
  Row,
  Screen,
  ScreenHeader,
  Stack,
  Text,
  useToast,
  type ToastOptions,
} from "@ampm/ui";

import { pickCsvFile } from "./pick-csv-file";
import {
  hasRejections,
  importSummary,
  IMPORT_TEMPLATE_HEADER,
  rejectedHeadline,
  rejectedRowText,
  REQUIRED_COLUMNS,
} from "./hotel-import.format";

/**
 * The toast for a completed run: a validate (dry run) announces whether any rows were rejected; a real
 * import announces whether anything was saved. The toast carries its own live region, so a screen-reader
 * user hears the outcome of Validate — the step the screen tells staff to do first — not only the import.
 */
function runToast(result: HotelImportResult): ToastOptions {
  if (result.dryRun) {
    return {
      title: hasRejections(result)
        ? "Validated — some rows rejected"
        : "Validated — all rows valid",
      tone: hasRejections(result) ? "warning" : "success",
    };
  }
  return {
    title: result.applied ? "Hotels imported" : "Nothing imported",
    tone: result.applied ? "success" : "danger",
  };
}

/** The import form: the CSV content, the validate/import run, and the result it keeps on screen. */
function useHotelImportForm() {
  const toast = useToast();
  const importHotels = useHotelImport();
  const [content, setContent] = useState("");
  const [result, setResult] = useState<HotelImportResult | null>(null);
  const run = (dryRun: boolean): void => {
    if (importHotels.isPending) return;
    const text = content.trim();
    if (text.length === 0) {
      toast.show({ title: "Paste or choose a CSV first", tone: "danger" });
      return;
    }
    setResult(null);
    importHotels.mutate(
      { content: text, dryRun },
      {
        onSuccess: (res) => {
          setResult(res);
          toast.show(runToast(res));
        },
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : "Could not run the import",
            tone: "danger",
          }),
      },
    );
  };
  return { content, setContent, result, run, pending: importHotels.isPending };
}

/** The template help: the column header and which columns are required. */
function ImportColumnsHint() {
  return (
    <Card padding="sm" testID="hotel-import-columns">
      <Stack gap={2}>
        <Text variant="label" tone="muted">
          CSV columns
        </Text>
        <Text variant="bodySmall" tone="primary">
          {IMPORT_TEMPLATE_HEADER}
        </Text>
        <Text variant="bodySmall" tone="muted">
          {`Required: ${REQUIRED_COLUMNS.join(", ")}. Blank cells are left unset. Validate first to check the file without saving.`}
        </Text>
      </Stack>
    </Card>
  );
}

interface ContentInputProps {
  readonly content: string;
  readonly setContent: (value: string) => void;
}

/** Choose a `.csv` on the web, or paste the CSV directly (works on every platform). */
function ImportContentInput({ content, setContent }: ContentInputProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const choose = (): void => {
    void pickCsvFile().then((picked) => {
      if (picked) {
        setContent(picked.content);
        setFileName(picked.name);
      }
    });
  };
  return (
    <Stack gap={2}>
      <Row gap={2} align="center" wrap>
        <Button
          variant="secondary"
          size="sm"
          icon="upload"
          onPress={choose}
          testID="hotel-import-choose"
        >
          Choose CSV file
        </Button>
        {fileName ? (
          <Text variant="bodySmall" tone="muted">
            {fileName}
          </Text>
        ) : null}
      </Row>
      <Input
        label="CSV content"
        value={content}
        onChangeText={(value) => {
          setContent(value);
          setFileName(null);
        }}
        placeholder="Paste the CSV here, or choose a file above."
        multiline
        testID="hotel-import-content"
      />
    </Stack>
  );
}

/** The outcome: a summary callout and, when rows were rejected, each one named by line and field. */
function ImportResultPanel({ result }: { readonly result: HotelImportResult }) {
  const headline = rejectedHeadline(result);
  return (
    <Card testID="hotel-import-result">
      <Stack gap={3}>
        <Callout
          kind={hasRejections(result) ? "warning" : "success"}
          title={importSummary(result)}
          blur={false}
        />
        {headline ? (
          <Stack gap={1}>
            <Text variant="label" tone="muted">
              {headline}
            </Text>
            {result.rejected.map((row) => (
              <Text
                key={row.line}
                variant="bodySmall"
                tone="primary"
                testID={`hotel-import-rejected-${row.line}`}
              >
                {rejectedRowText(row)}
              </Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

export interface HotelImportScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * Bulk-import the hotel catalogue from a CSV (H1.1, TW-25; Hotel team and Super Admin). Paste the CSV or
 * choose a `.csv` file, **Validate** to check it without saving (reports rejected rows by line and field),
 * then **Import** to upsert the valid rows — invalid rows are reported, never applied, and the catalogue
 * refreshes. The server is the gate.
 *
 *   <HotelImportScreen tabBar={<AppTabBar />} />
 */
export function HotelImportScreen({ tabBar }: HotelImportScreenProps) {
  const router = useRouter();
  const { content, setContent, result, run, pending } = useHotelImportForm();
  return (
    <Screen
      tabBar={tabBar}
      header={<ScreenHeader eyebrow="Hotels" title="Import hotels" onBack={() => router.back()} />}
    >
      <Stack gap={4}>
        <ImportColumnsHint />
        <ImportContentInput content={content} setContent={setContent} />
        <Row gap={2} wrap>
          <Button
            variant="secondary"
            loading={pending}
            onPress={() => run(true)}
            testID="hotel-import-validate"
          >
            Validate
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onPress={() => run(false)}
            testID="hotel-import-run"
          >
            Import
          </Button>
        </Row>
        {result ? <ImportResultPanel result={result} /> : null}
      </Stack>
    </Screen>
  );
}
