import { UPLOAD_REFUSAL_MESSAGES, type HotelDocumentView } from "@ampm/core";
import { pickFile, type PickedFile } from "@ampm/ui";
import type * as UiModule from "@ampm/ui";

import { jsonResponse, ok } from "../../test/api";
import { fireEvent, screen, within } from "../../test/render";
import { HotelDocumentsScreen } from "./hotel-documents-screen";
import {
  documentsFetch,
  hotelDocumentFixture,
  untilSettled,
  type DocumentsApi,
} from "./hotel-documents.test-utils";
import { HOTEL_ID, renderWithApi } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  pickFile: jest.fn(),
}));

function pdf(): PickedFile {
  return {
    file: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
    mimeType: "application/pdf",
    sizeBytes: 2 * 1024 * 1024,
    name: "menu.pdf",
  };
}

/** An upload the API answers only when the test says. */
function answeredLater() {
  let answer: (response: Response) => void = () => undefined;
  const answered = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  return { upload: () => answered, answer };
}

const macrosRefusal = () =>
  jsonResponse(
    {
      error: {
        code: "validation_failed",
        message: "Validation failed",
        details: [{ path: "file", message: UPLOAD_REFUSAL_MESSAGES.macros }],
      },
    },
    400,
  );

/** The tab, settled, as the Hotel team sees it. */
async function renderLibrary(api: DocumentsApi) {
  const client = await renderWithApi(
    <HotelDocumentsScreen hotelId={HOTEL_ID} />,
    documentsFetch(api),
  );
  await untilSettled(client);
  return client;
}

/** Closes the upload sheet from its own Close button. */
async function closeSheet() {
  const panel = screen.getByTestId("document-upload-panel");
  await fireEvent.press(within(panel).getByRole("button", { name: "Close" }));
}

/** Opens the upload sheet, picks a PDF as a floor plan and sends it. */
async function sendFloorPlan() {
  await fireEvent.press(screen.getByTestId("documents-upload"));
  await fireEvent.press(await screen.findByRole("radio", { name: "Floor plan" }));
  await fireEvent.press(screen.getByTestId("document-upload-choose"));
  await fireEvent.press(await screen.findByTestId("document-upload-submit"));
}

beforeEach(() => {
  jest.mocked(pickFile).mockReset();
  jest.mocked(pickFile).mockResolvedValue(pdf());
});

describe("an upload answered after its sheet has closed (D-187 §6)", () => {
  it("reports a refusal in a toast that names the file", async () => {
    const later = answeredLater();
    const client = await renderLibrary({ upload: later.upload });
    await sendFloorPlan();
    await closeSheet();
    expect(screen.queryByTestId("document-upload-submit")).toBeNull();
    later.answer(macrosRefusal());
    expect(await screen.findByText("menu.pdf was not uploaded")).toBeOnTheScreen();
    expect(screen.getByText(UPLOAD_REFUSAL_MESSAGES.macros)).toBeOnTheScreen();
    await untilSettled(client);
  });

  it("reports the outcome after another sheet was opened, and leaves that sheet open", async () => {
    const later = answeredLater();
    const client = await renderLibrary({ upload: later.upload });
    await sendFloorPlan();
    await closeSheet();
    // A fresh sheet replaces the first, which is gone with its upload still in flight.
    await fireEvent.press(screen.getByTestId("documents-upload"));
    expect(await screen.findByRole("radio", { name: "Fact sheet" })).toBeOnTheScreen();
    later.answer(ok(hotelDocumentFixture({ title: "Lawns", versionNumber: 1, versions: [] })));
    expect(await screen.findByText("Lawns uploaded")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Fact sheet" })).toBeOnTheScreen();
    await untilSettled(client);
  });

  it("still shows a refusal under the file while the sheet is open", async () => {
    const client = await renderLibrary({ upload: macrosRefusal });
    await sendFloorPlan();
    expect(await screen.findByTestId("document-upload-error")).toHaveTextContent(
      UPLOAD_REFUSAL_MESSAGES.macros,
    );
    expect(screen.queryByText("menu.pdf was not uploaded")).toBeNull();
    await untilSettled(client);
  });
});

describe("a new version refused because its document changed meanwhile", () => {
  const newer = hotelDocumentFixture({ versionNumber: 3 });
  it.each<[string, number, string, string, readonly HotelDocumentView[], string]>([
    [
      "a newer version was filed since",
      409,
      "conflict",
      "A newer version of this document was filed since; reload and try again",
      [newer],
      "Version 3 · PDF · 2.4 MB · 12 NOV 2026",
    ],
    ["the document was removed", 404, "not_found", "No such document", [], "No documents yet"],
  ])(
    "closes the sheet when %s, says why in a toast and refreshes the list",
    async (_case, status, code, message, after, refreshed) => {
      let answered = false;
      const client = await renderLibrary({
        documents: () => (answered ? after : [hotelDocumentFixture()]),
        upload: () => {
          answered = true;
          return jsonResponse({ error: { code, message } }, status);
        },
      });
      await fireEvent.press(screen.getByRole("button", { name: "Replace Banquet menu" }));
      await fireEvent.press(await screen.findByTestId("document-upload-choose"));
      await fireEvent.press(await screen.findByTestId("document-upload-submit"));
      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(screen.queryByTestId("document-upload-submit")).toBeNull();
      expect(await screen.findByText(refreshed)).toBeOnTheScreen();
      await untilSettled(client);
    },
  );
});
