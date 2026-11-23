import { jsonResponse } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { HotelImportScreen } from "./hotel-import-screen";
import {
  appliedResult,
  IMPORT_CSV,
  importFetch,
  type ImportRequest,
} from "./hotel-import.test-utils";
import { pickCsvFile } from "./pick-csv-file";
import { renderWithApi, routedFetch, type FetchFn } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

beforeEach(() => {
  jest.mocked(pickCsvFile).mockReset();
});

async function renderImport(fetchImpl: FetchFn): Promise<void> {
  await renderWithApi(<HotelImportScreen />, fetchImpl);
}

/** Pastes the CSV and presses Validate. */
async function validate(csv = IMPORT_CSV): Promise<void> {
  await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), csv);
  await fireEvent.press(screen.getByTestId("hotel-import-validate"));
}

describe("HotelImportScreen", () => {
  it("validates the raw CSV as a dry run and reports each row without saving", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await validate();
    expect(
      await screen.findByText(
        "Checked 3 rows: 1 to add, 1 to update, 0 unchanged, 1 rejected — nothing saved yet.",
      ),
    ).toBeOnTheScreen();
    // The file goes up as it is, raw bytes on the dry-run address, never wrapped in JSON.
    expect(requests).toEqual([
      {
        path: "/hotels-admin/imports/hotels?dryRun=true",
        body: IMPORT_CSV,
        contentType: "application/octet-stream",
      },
    ]);
    expect(screen.getByText("2 hotels to add or update")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-row-2")).toHaveTextContent(
      "Line 2 · synthetic-lake-hotel · Update: city",
    );
    expect(screen.getByTestId("hotel-import-row-4")).toHaveTextContent(
      "Line 4 · synthetic-beach-resort · New hotel: destinationSlug, name",
    );
    expect(screen.getByText("Line 3: destinationSlug — required")).toBeOnTheScreen();
    // The dry-run outcome is announced (its own live toast), not only shown in the panel.
    expect(screen.getByText("Validated — some rows rejected")).toBeOnTheScreen();
  });

  it("keeps Import locked until the CSV has been validated, then applies that CSV", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), IMPORT_CSV);
    expect(screen.getByTestId("hotel-import-locked")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(requests).toEqual([]);
    await fireEvent.press(screen.getByTestId("hotel-import-validate"));
    await screen.findByText("Validated — some rows rejected");
    expect(screen.queryByTestId("hotel-import-locked")).toBeNull();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Hotels imported")).toBeOnTheScreen();
    expect(
      screen.getByText("Imported 1 created · 1 updated · 1 new destinations."),
    ).toBeOnTheScreen();
    expect(requests.map((request) => request.path)).toEqual([
      "/hotels-admin/imports/hotels?dryRun=true",
      "/hotels-admin/imports/hotels?dryRun=false",
    ]);
    expect(requests[1]?.body).toBe(IMPORT_CSV);
  });

  it("locks Import again when the CSV changes after validating", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await validate();
    await screen.findByText("Validated — some rows rejected");
    await fireEvent.changeText(screen.getByTestId("hotel-import-content"), `${IMPORT_CSV}\nx,y`);
    expect(screen.getByTestId("hotel-import-locked")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(requests).toHaveLength(1);
  });

  // A real run that wrote nothing answers `applied: false` (core hotelImportResult; the API's
  // hotel-import e2e re-imports a loaded file and expects the same).
  it("says nothing was imported when every row already matches the catalogue", async () => {
    const unchanged = { created: 0, updated: 0, unchanged: 3, rejected: [], rows: [] };
    const fetch = importFetch([], {
      applied: appliedResult({ ...unchanged, applied: false, destinationsCreated: 0 }),
    });
    await renderImport(fetch);
    await validate();
    await screen.findByText("Validated — some rows rejected");
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Nothing imported")).toBeOnTheScreen();
    expect(screen.getByText("Nothing imported — 3 unchanged.")).toBeOnTheScreen();
  });

  it("blocks an empty validate and sends nothing", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await fireEvent.press(await screen.findByTestId("hotel-import-validate"));
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    expect(requests).toEqual([]);
  });

  it("blocks a whitespace-only validate and sends nothing", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await validate("   \n  \t");
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    expect(requests).toEqual([]);
  });

  it("surfaces the server's message in a toast when the import is refused", async () => {
    await renderImport(
      routedFetch({
        "/hotels-admin/imports/hotels": () =>
          jsonResponse({ error: { code: "forbidden", message: "You cannot import hotels." } }, 403),
      }),
    );
    await validate();
    expect(await screen.findByText("You cannot import hotels.")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-locked")).toBeOnTheScreen();
  });

  it("fills the content and file-name hint from a chosen CSV, clearing the hint on manual edit", async () => {
    jest.mocked(pickCsvFile).mockResolvedValue({ content: IMPORT_CSV, name: "hotels.csv" });
    await renderImport(importFetch([]));
    await fireEvent.press(await screen.findByTestId("hotel-import-choose"));
    expect(await screen.findByText("hotels.csv")).toBeOnTheScreen();
    expect(await screen.findByDisplayValue(IMPORT_CSV)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("hotel-import-content"), `${IMPORT_CSV}\nx,y`);
    expect(screen.queryByText("hotels.csv")).not.toBeOnTheScreen();
  });

  it("leaves the form empty when the file picker returns nothing", async () => {
    const requests: ImportRequest[] = [];
    jest.mocked(pickCsvFile).mockResolvedValue(null);
    await renderImport(importFetch(requests));
    await fireEvent.press(await screen.findByTestId("hotel-import-choose"));
    await fireEvent.press(screen.getByTestId("hotel-import-validate"));
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    expect(requests).toEqual([]);
  });
});
