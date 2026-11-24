import { CONTENT_KINDS, UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import { pickFile, type PickedFile } from "@ampm/ui";
import type * as UiModule from "@ampm/ui";

import { jsonResponse, ok } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { HotelDocumentsScreen } from "./hotel-documents-screen";
import { documentAccept } from "./hotel-documents.format";
import {
  DOCUMENT_ID,
  DOCUMENTS,
  documentsFetch,
  hotelDocumentFixture,
  untilSettled,
  type DocumentsApi,
  type SentRequest,
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

const MIB = 1024 * 1024;

function pdf(sizeBytes = 2 * MIB): PickedFile {
  return {
    file: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
    mimeType: "application/pdf",
    sizeBytes,
    name: "menu.pdf",
  };
}

/** The tab, settled, as the Hotel team sees it by default; returns its client to settle again. */
async function renderLibrary(api: DocumentsApi) {
  const client = await renderWithApi(
    <HotelDocumentsScreen hotelId={HOTEL_ID} />,
    documentsFetch(api),
  );
  await untilSettled(client);
  return client;
}

/** Opens the upload sheet from the screen's gold action. */
async function openUpload(api: DocumentsApi = {}) {
  const client = await renderLibrary(api);
  await fireEvent.press(screen.getByTestId("documents-upload"));
  expect(await screen.findByRole("radio", { name: "Fact sheet" })).not.toBeChecked();
  return client;
}

beforeEach(() => {
  jest.mocked(pickFile).mockReset();
});

describe("DocumentUploadSheet: a new document", () => {
  it("uploads the file as raw bytes with its type and title", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue(pdf());
    const filed = hotelDocumentFixture({
      title: "Banquet menu 2027",
      versionNumber: 1,
      versions: [],
    });
    const client = await openUpload({ sent, upload: () => ok(filed) });
    await fireEvent.press(screen.getByRole("radio", { name: "Food menu" }));
    expect(
      screen.getByText("Takes PDF, JPEG or PNG up to 20 MB, or Excel up to 10 MB."),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("document-upload-title"), " Banquet menu 2027 ");
    await fireEvent.press(screen.getByTestId("document-upload-choose"));
    // The picker offers the food menu's kinds by media type and extension, Excel included.
    expect(pickFile).toHaveBeenCalledWith(documentAccept("menu"));
    expect(await screen.findByText("menu.pdf · 2 MB")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("document-upload-submit"));
    expect(await screen.findByText("Banquet menu 2027 uploaded")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "POST",
        path: DOCUMENTS,
        query: "type=menu&title=Banquet+menu+2027",
        contentType: "application/octet-stream",
        json: null,
      },
    ]);
    await untilSettled(client);
  });

  it("names a document after its type when no title is given", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue(pdf());
    const client = await openUpload({ sent });
    await fireEvent.press(screen.getByRole("radio", { name: "Floor plan" }));
    expect(screen.getByText("Optional. Left blank, it is called “Floor plan”.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("document-upload-choose"));
    await fireEvent.press(await screen.findByTestId("document-upload-submit"));
    expect(await screen.findByText("Banquet menu uploaded")).toBeOnTheScreen();
    expect(sent.map((request) => request.query)).toEqual(["type=floor_plan"]);
    await untilSettled(client);
  });

  it("asks what the document is and for its file before sending anything", async () => {
    const sent: SentRequest[] = [];
    const client = await openUpload({ sent });
    await fireEvent.press(screen.getByTestId("document-upload-submit"));
    expect(await screen.findByText("Choose what this document is")).toBeOnTheScreen();
    expect(screen.getByText("Choose the file to upload")).toBeOnTheScreen();
    expect(sent).toEqual([]);
    await untilSettled(client);
  });

  it("offers every kind the library takes when the file is picked before the type", async () => {
    jest.mocked(pickFile).mockResolvedValue(pdf());
    const client = await openUpload();
    await fireEvent.press(screen.getByTestId("document-upload-choose"));
    expect(pickFile).toHaveBeenCalledWith(documentAccept(null));
    await untilSettled(client);
  });

  it("refuses a file over its kind's limit for the type without sending it", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue({
      file: new Blob(["PK"]),
      mimeType: CONTENT_KINDS.xlsx.mimeType,
      sizeBytes: 11 * MIB,
      name: "menu.xlsx",
    });
    const client = await openUpload({ sent });
    await fireEvent.press(screen.getByRole("radio", { name: "Food menu" }));
    await fireEvent.press(screen.getByTestId("document-upload-choose"));
    expect(
      await screen.findByText("This Excel file is over the 10 MB limit for food menus"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("document-upload-submit"));
    expect(sent).toEqual([]);
    await untilSettled(client);
  });

  it("says the chosen type does not take the picked file's kind, without sending it", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue({
      file: new Blob(["PK"]),
      mimeType: CONTENT_KINDS.xlsx.mimeType,
      sizeBytes: 2 * MIB,
      name: "menu.xlsx",
    });
    const client = await openUpload({ sent });
    await fireEvent.press(screen.getByTestId("document-upload-choose"));
    await fireEvent.press(await screen.findByRole("radio", { name: "Floor plan" }));
    expect(await screen.findByText("Floor plans take PDF, JPEG or PNG")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("document-upload-submit"));
    expect(sent).toEqual([]);
    await untilSettled(client);
  });
});

describe("DocumentUploadSheet: the API's answers", () => {
  const busy = "The server is busy with other uploads. Try again in 5 seconds.";
  const full =
    "A hotel can hold at most 100 documents: remove one, or replace one with its new version";
  it.each([
    [
      "a type the upload does not take",
      415,
      "unsupported_media_type",
      "Unsupported media type",
      UPLOAD_REFUSAL_MESSAGES.word_document,
    ],
    [
      "a file refused inside its type",
      400,
      "validation_failed",
      "Validation failed",
      UPLOAD_REFUSAL_MESSAGES.macros,
    ],
    ["a busy server", 503, "unavailable", busy, busy],
    ["a full library", 409, "conflict", full, full],
  ])(
    "shows the message for %s, keeping the sheet and the file",
    async (_case, status, code, message, shown) => {
      const onFile = message !== shown;
      jest.mocked(pickFile).mockResolvedValue(pdf());
      const client = await openUpload({
        upload: () =>
          jsonResponse(
            {
              error: {
                code,
                message,
                ...(onFile ? { details: [{ path: "file", message: shown }] } : {}),
              },
            },
            status,
          ),
      });
      await fireEvent.press(screen.getByRole("radio", { name: "Floor plan" }));
      await fireEvent.press(screen.getByTestId("document-upload-choose"));
      await fireEvent.press(await screen.findByTestId("document-upload-submit"));
      expect(await screen.findByTestId("document-upload-error")).toHaveTextContent(shown);
      // The sheet stays open with the file chosen, ready to try again.
      expect(screen.getByText("menu.pdf · 2 MB")).toBeOnTheScreen();
      await untilSettled(client);
    },
  );
});

describe("DocumentUploadSheet: a new version", () => {
  it("keeps the type, starts from the current title and names the document it replaces", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue(pdf());
    const client = await renderLibrary({ documents: [hotelDocumentFixture()], sent });
    await fireEvent.press(screen.getByRole("button", { name: "Replace Banquet menu" }));
    expect(await screen.findByText("Replace Banquet menu")).toBeOnTheScreen();
    expect(screen.getByTestId("document-upload-kept-type")).toHaveTextContent(/Food menu/);
    expect(screen.queryByRole("radio", { name: "Fact sheet" })).toBeNull();
    expect(screen.getByTestId("document-upload-title")).toHaveDisplayValue("Banquet menu");
    expect(
      screen.getByText("Optional. Left blank, it keeps its title “Banquet menu”."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("document-upload-choose"));
    expect(pickFile).toHaveBeenCalledWith(documentAccept("menu"));
    await fireEvent.press(await screen.findByTestId("document-upload-submit"));
    expect(await screen.findByText("Banquet menu is now version 3")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "POST",
        path: DOCUMENTS,
        query: `type=menu&title=Banquet+menu&replaces=${DOCUMENT_ID}`,
        contentType: "application/octet-stream",
        json: null,
      },
    ]);
    await untilSettled(client);
  });
});
