import { HOTEL_IMPORT_COLUMNS, type HotelImportRowReport } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { HotelImportScreen } from "./hotel-import-screen";
import {
  dryRunResult,
  IMPORT_CSV,
  importFetch,
  type ImportRequest,
} from "./hotel-import.test-utils";
import { renderWithApi } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

// The web workspace saves the file; the test keeps what would have been saved.
const mockDownloadCsv = jest.fn<boolean, [string, string]>(() => true);
jest.mock("../admin/download-csv", () => ({
  downloadCsv: (filename: string, csv: string) => mockDownloadCsv(filename, csv),
}));

beforeEach(() => {
  mockDownloadCsv.mockClear();
  mockDownloadCsv.mockReturnValue(true);
});

/** Pastes the CSV and presses Validate, waiting for its report. */
async function validate(): Promise<void> {
  await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), IMPORT_CSV);
  await fireEvent.press(screen.getByTestId("hotel-import-validate"));
  await screen.findByTestId("hotel-import-result");
}

/** A dry-run report with `count` hotels to update, from line 2. */
function manyUpdates(count: number): HotelImportRowReport[] {
  return Array.from({ length: count }, (_, index): HotelImportRowReport => ({
    line: index + 2,
    slug: `synthetic-hotel-${index + 1}`,
    outcome: "update",
    changedFields: ["city"],
  }));
}

describe("HotelImportScreen downloads", () => {
  it("downloads the template as the header row of the core columns, and nothing else", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch([]));
    await fireEvent.press(await screen.findByTestId("hotel-import-template"));
    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = mockDownloadCsv.mock.calls[0]!;
    expect(filename).toBe("hotels-import-template.csv");
    expect(csv).toBe(`\uFEFF${HOTEL_IMPORT_COLUMNS.join(",")}`);
  });

  it("downloads the per-row report of a validate, the rejected rows with their reasons", async () => {
    const requests: ImportRequest[] = [];
    await renderWithApi(<HotelImportScreen />, importFetch(requests));
    await validate();
    expect(screen.getByTestId("hotel-import-report")).toHaveTextContent("Download error report");
    await fireEvent.press(screen.getByTestId("hotel-import-report"));
    const [filename, csv] = mockDownloadCsv.mock.calls[0]!;
    expect(filename).toBe("hotels-import-report.csv");
    expect(csv.split("\r\n")).toEqual([
      "line,slug,outcome,changedFields,errors",
      "2,synthetic-lake-hotel,update,city,",
      "3,,error,,destinationSlug: required",
      '4,synthetic-beach-resort,create,"destinationSlug, name",',
    ]);
    expect(requests).toHaveLength(1);
  });

  it("says to download from the web where a file cannot be saved", async () => {
    mockDownloadCsv.mockReturnValue(false);
    await renderWithApi(<HotelImportScreen />, importFetch([]));
    await fireEvent.press(await screen.findByTestId("hotel-import-template"));
    expect(await screen.findByText("Download from the web workspace")).toBeOnTheScreen();
  });

  it("lists at most 20 changing rows on screen and points at the report for the rest", async () => {
    const dry = dryRunResult({ totalRows: 25, updated: 25, created: 0, rejected: [] });
    await renderWithApi(
      <HotelImportScreen />,
      importFetch([], { dry: { ...dry, rows: manyUpdates(25) } }),
    );
    await validate();
    expect(screen.getByText("25 hotels to add or update")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-row-21")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-import-row-22")).toBeNull();
    expect(screen.getByText("5 more in the downloaded report.")).toBeOnTheScreen();
  });
});
