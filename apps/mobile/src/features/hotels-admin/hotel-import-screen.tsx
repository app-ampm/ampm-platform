import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { useHotelImport } from "@ampm/api-client";
import { isAppError, type HotelImportResult } from "@ampm/core";
import {
  Button,
  Card,
  Input,
  Row,
  Screen,
  ScreenHeader,
  SplitPane,
  Stack,
  Text,
  useLayoutAt,
  useToast,
  type ToastOptions,
} from "@ampm/ui";

import { ImportResultPanel } from "./hotel-import-result";
import {
  hasRejections,
  IMPORT_COLUMNS_HINT,
  IMPORT_RULES,
  IMPORT_TEMPLATE_FILE,
  importInputProblem,
  importTemplateCsv,
} from "./hotel-import.format";
import { pickCsvFile } from "./pick-csv-file";
import { useCsvDownload } from "./use-csv-download";

/**
 * The toast for a completed run: a validate (dry run) announces whether any rows were rejected; a real
 * import announces whether anything was saved. The toast carries its own live region, so a screen-reader
 * user hears the outcome of Validate — the step the screen asks for first — not only the import.
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
  if (result.applied) return { title: "Hotels imported", tone: "success" };
  return { title: "Nothing imported", tone: hasRejections(result) ? "danger" : "info" };
}

/**
 * The import form: the CSV, the validate and import runs, and the result kept on screen. Validate sends
 * the CSV as a dry run; Import applies it and unlocks only while the CSV is the one just validated, so
 * staff always see what a file would change before it changes anything.
 */
function useHotelImportForm() {
  const toast = useToast();
  const importHotels = useHotelImport();
  const [content, setContent] = useState("");
  const [result, setResult] = useState<HotelImportResult | null>(null);
  const [checkedCsv, setCheckedCsv] = useState<string | null>(null);
  const run = (dryRun: boolean): void => {
    if (importHotels.isPending) return;
    const csv = content.trim();
    const problem = importInputProblem(csv);
    if (problem) return void toast.show({ title: problem, tone: "danger" });
    setResult(null);
    importHotels.mutate(
      { csv, dryRun },
      {
        onSuccess: (res) => {
          setResult(res);
          setCheckedCsv(dryRun ? csv : null);
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
  const canImport = checkedCsv !== null && checkedCsv === content.trim();
  return { content, setContent, result, run, canImport, pending: importHotels.isPending };
}

/** The template help: the columns, the rules of a file, and the template to download. */
function ImportColumnsHint() {
  const download = useCsvDownload();
  return (
    <Card padding="sm" testID="hotel-import-columns">
      <Stack gap={2}>
        <Text variant="label" tone="muted">
          CSV columns
        </Text>
        <Text variant="bodySmall" tone="primary">
          {IMPORT_COLUMNS_HINT}
        </Text>
        <Text variant="bodySmall" tone="muted">
          {IMPORT_RULES}
        </Text>
        <Row gap={2} wrap>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onPress={() => download(IMPORT_TEMPLATE_FILE, importTemplateCsv())}
            testID="hotel-import-template"
          >
            Download template
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}

interface ContentInputProps {
  readonly content: string;
  readonly setContent: (value: string) => void;
  /** Beside the side column on a desktop, the box shows a screenful of rows (a prop, not a new box). */
  readonly tall: boolean;
}

/** Choose a `.csv` (the web workspace's file picker), with the chosen file's name beside it. */
function ChooseCsv({
  fileName,
  onPress,
}: {
  readonly fileName: string | null;
  readonly onPress: () => void;
}) {
  return (
    <Row gap={2} align="center" wrap>
      <Button
        variant="secondary"
        size="sm"
        icon="upload"
        onPress={onPress}
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
  );
}

/** Choose a `.csv` on the web, or paste the CSV directly (works on every platform). */
function ImportContentInput({ content, setContent, tall }: ContentInputProps) {
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
      <ChooseCsv fileName={fileName} onPress={choose} />
      <Input
        label="CSV content"
        value={content}
        onChangeText={(value) => {
          setContent(value);
          setFileName(null);
        }}
        placeholder="Paste the CSV here, or choose a file above."
        multiline
        {...(tall ? { numberOfLines: 14 } : {})}
        testID="hotel-import-content"
      />
    </Stack>
  );
}

interface ImportActionsProps {
  readonly pending: boolean;
  readonly canImport: boolean;
  readonly run: (dryRun: boolean) => void;
}

/** Validate first (a dry run that saves nothing), then Import, the screen's gold action. */
function ImportActions({ pending, canImport, run }: ImportActionsProps) {
  return (
    <Stack gap={2}>
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
          disabled={!canImport}
          onPress={() => run(false)}
          testID="hotel-import-run"
        >
          Import
        </Button>
      </Row>
      {canImport ? null : (
        <Text variant="bodySmall" tone="muted" testID="hotel-import-locked">
          Validate the CSV first: Import applies the file you checked.
        </Text>
      )}
    </Stack>
  );
}

export interface HotelImportScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * Bulk-import the hotel catalogue from a CSV (H1.1, TW-25, D-181; Hotel team and Super Admin). Download
 * the template, then paste the CSV or choose a `.csv` file. **Validate** sends it as a dry run and
 * reports each row: the hotels it would add or update with the columns that change, and the rejected
 * rows by line and field, downloadable as a report. **Import** then applies the valid rows of that same
 * CSV; on a hotel already in the catalogue a blank cell leaves the value unchanged. The server is the
 * gate. From 1024 the CSV and its actions sit beside a column with the template help and the result; the
 * column hint moves between two fixed slots (it holds no state), and the CSV stays in its slot, so a
 * resize never loses what was pasted.
 *
 *   <HotelImportScreen tabBar={<AppTabBar />} />
 */
export function HotelImportScreen({ tabBar }: HotelImportScreenProps) {
  const router = useRouter();
  const { content, setContent, result, run, canImport, pending } = useHotelImportForm();
  const isDesktop = useLayoutAt("lg");
  const side = (
    <Stack gap={4} testID="hotel-import-side">
      {isDesktop ? <ImportColumnsHint /> : null}
      {result ? <ImportResultPanel result={result} /> : null}
    </Stack>
  );
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<ScreenHeader eyebrow="Hotels" title="Import hotels" onBack={() => router.back()} />}
    >
      <SplitPane sideWidth="lg" side={side} testID="hotel-import-split">
        <Stack gap={4} testID="hotel-import-main">
          {isDesktop ? null : <ImportColumnsHint />}
          <ImportContentInput content={content} setContent={setContent} tall={isDesktop} />
          <ImportActions pending={pending} canImport={canImport} run={run} />
        </Stack>
      </SplitPane>
    </Screen>
  );
}
