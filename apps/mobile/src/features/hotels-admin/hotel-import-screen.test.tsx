import { jsonResponse, ok } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelImportScreen } from "./hotel-import-screen";
import {
  appliedResult,
  dryRunResult,
  IMPORT_CSV,
  IMPORT_JOB_ID,
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
  it("previews the raw CSV and reports each row without saving", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await validate();
    expect(
      await screen.findByText(
        "Checked 3 rows: 1 to add, 1 to update, 0 unchanged, 1 rejected — nothing saved yet.",
      ),
    ).toBeOnTheScreen();
    // The file goes up as it is, raw bytes on the kind's preview address, never wrapped in JSON.
    expect(requests).toEqual([
      {
        path: "/hotels-admin/imports/hotels",
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
    // The preview's outcome is announced (its own live toast), not only shown in the panel.
    expect(screen.getByText("Validated — some rows rejected")).toBeOnTheScreen();
  });

  it("keeps Import locked until validated, then imports that preview by its job id", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), IMPORT_CSV);
    expect(screen.getByTestId("hotel-import-locked")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(requests).toEqual([]);
    await fireEvent.press(screen.getByTestId("hotel-import-validate"));
    await screen.findByText("Validated — some rows rejected");
    expect(screen.queryByTestId("hotel-import-locked")).toBeNull();
    expect(screen.getByTestId("hotel-import-ttl")).toHaveTextContent(
      "A preview can be imported for 24 hours.",
    );
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(await screen.findByText("Hotels imported")).toBeOnTheScreen();
    expect(
      screen.getByText("Imported 1 created · 1 updated · 1 new destination."),
    ).toBeOnTheScreen();
    // Import sends the job, never the file again: an empty JSON body on the apply address.
    expect(requests[1]).toEqual({
      path: `/hotels-admin/imports/hotels/${IMPORT_JOB_ID}/apply`,
      body: "{}",
      contentType: "application/json",
    });
    // A preview imports once: Import locks again until the next Validate.
    expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
    expect(screen.getByTestId("hotel-import-locked")).toBeOnTheScreen();
  });

  it("locks Import again when the CSV changes after validating, marking the report as the old CSV's", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await validate();
    await screen.findByText("Validated — some rows rejected");
    expect(screen.queryByTestId("hotel-import-result-stale")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("hotel-import-content"), `${IMPORT_CSV}\nx,y`);
    expect(screen.getByTestId("hotel-import-locked")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-result-stale")).toHaveTextContent(
      "This report is of the CSV as it was before your last change. Validate again to check it as it is now.",
    );
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(requests).toHaveLength(1);
  });

  it("lets Import register the images of a file whose rows all match the catalogue", async () => {
    const requests: ImportRequest[] = [];
    const rows = [
      {
        line: 2,
        slug: "synthetic-lake-hotel",
        name: "Synthetic Lake Hotel",
        outcome: "unchanged" as const,
        changedFields: [],
      },
    ];
    const images = { totalRows: 1, created: 0, updated: 0, unchanged: 1, rejected: [], rows };
    const dry = dryRunResult({ ...images, mediaRegistered: 1 });
    const applied = appliedResult({ ...images, mediaRegistered: 1, destinationsCreated: 0 });
    await renderImport(importFetch(requests, { dry: { hotels: dry }, applied }));
    await validate();
    await screen.findByText("Validated — all rows valid");
    expect(screen.queryByTestId("hotel-import-locked")).toBeNull();
    await fireEvent.press(screen.getByTestId("hotel-import-run"));
    expect(
      await screen.findByText("Imported 0 created · 0 updated · 1 unchanged · 1 image."),
    ).toBeOnTheScreen();
    expect(requests).toHaveLength(2);
  });

  it("keeps Import off when the preview would neither add, update nor register anything", async () => {
    const nothing = dryRunResult({ created: 0, updated: 0, unchanged: 2, rows: [] });
    await renderImport(importFetch([], { dry: { hotels: nothing } }));
    await validate();
    await screen.findByText("Validated — some rows rejected");
    expect(screen.getByTestId("hotel-import-run")).toBeDisabled();
    expect(screen.getByTestId("hotel-import-locked")).toHaveTextContent(
      "Nothing to import: every row is unchanged or rejected.",
    );
  });

  it("says in the preview's toast and summary when importing would add destinations", async () => {
    await renderImport(
      importFetch([], { dry: { hotels: dryRunResult({ destinationsCreated: 1 }) } }),
    );
    await validate();
    expect(await screen.findByText("Importing would add 1 new destination.")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Checked 3 rows: 1 to add, 1 to update, 0 unchanged, 1 rejected — would add 1 new destination; nothing saved yet.",
      ),
    ).toBeOnTheScreen();
  });

  // An import that wrote nothing answers `applied: false` (core hotelImportResult): its rows matched
  // the catalogue by then, or were refused as changed since the preview.
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

  it("blocks an empty or whitespace-only validate and sends nothing", async () => {
    const requests: ImportRequest[] = [];
    await renderImport(importFetch(requests));
    await fireEvent.press(await screen.findByTestId("hotel-import-validate"));
    expect(await screen.findByText("Paste or choose a CSV first")).toBeOnTheScreen();
    await validate("   \n  \t");
    expect(requests).toEqual([]);
  });

  it("surfaces the server's message in a toast when the preview is refused", async () => {
    await renderImport(
      routedFetch({
        "/me": () => ok(staffMeFixture(["HT"])),
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

  it("says a chosen file over 5 MB was not read, leaving the paste box as it was", async () => {
    jest.mocked(pickCsvFile).mockResolvedValue({ content: null, name: "big.csv" });
    await renderImport(importFetch([]));
    await fireEvent.press(await screen.findByTestId("hotel-import-choose"));
    expect(
      await screen.findByText("big.csv is over 5 MB: split it into smaller files"),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-content").props.value).toBe("");
    expect(screen.queryByText("big.csv")).not.toBeOnTheScreen();
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
