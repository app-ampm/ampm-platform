import { Linking } from "react-native";

import { jsonResponse, offlineFetch, pendingFetch } from "../../test/api";
import { fireEvent, screen, waitFor, within } from "../../test/render";
import { HotelDocumentsScreen } from "./hotel-documents-screen";
import {
  DOCUMENT_ID,
  DOCUMENTS,
  documentsFetch,
  EARLIER_VERSION_ID,
  factSheetFixture,
  hotelDocumentFixture,
  LINK_PATH,
  untilSettled,
  type DocumentsApi,
  type SentRequest,
} from "./hotel-documents.test-utils";
import {
  failure,
  HOTEL_ID,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

async function renderTab(fetch: FetchFn) {
  return renderWithApi(<HotelDocumentsScreen hotelId={HOTEL_ID} />, fetch);
}

/** The tab over the documents API, once the hotel, `/me` and the list have all answered. */
async function renderLibrary(api: DocumentsApi = {}) {
  const client = await renderTab(documentsFetch(api));
  await untilSettled(client);
  return client;
}

describe("HotelDocumentsScreen: states", () => {
  it("shows the loading state while the documents load", async () => {
    await renderTab(pendingFetch);
    expect(await screen.findByTestId("documents-loading")).toBeOnTheScreen();
  });

  it("shows an error with a retry when the documents fail to load", async () => {
    await untilSettled(
      await renderTab(routedFetch({ [DOCUMENTS]: () => failure("internal", 500) })),
    );
    expect(screen.getByText("Try again")).toBeOnTheScreen();
  });

  it("says it is offline, with a retry, when the API cannot be reached", async () => {
    await untilSettled(await renderTab(offlineFetch));
    expect(screen.getByText("You are offline")).toBeOnTheScreen();
  });

  // Denial equals absence: a role without the read key gets the same 404 as a removed hotel.
  it("reads a 404 as documents this person cannot see, or a hotel that has gone", async () => {
    await untilSettled(
      await renderTab(routedFetch({ [DOCUMENTS]: () => failure("not_found", 404) })),
    );
    expect(screen.getByText("No documents to show")).toBeOnTheScreen();
  });

  it("tells the Hotel team what creates the first document, with the upload at hand", async () => {
    await renderLibrary({ documents: [], roles: ["HT"] });
    expect(screen.getByText("No documents yet")).toBeOnTheScreen();
    expect(
      screen.getByText(/Upload the hotel's fact sheet, menus and floor plans/),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Upload document" })).toBeOnTheScreen();
    expect(screen.getByText("0 of 100 documents")).toBeOnTheScreen();
  });

  it("says what each type takes beside the library, and that it is internal", async () => {
    await renderLibrary();
    const guide = screen.getByTestId("documents-guide");
    expect(within(guide).getByText("PDF up to 20 MB, or PowerPoint up to 25 MB")).toBeOnTheScreen();
    expect(within(guide).getByText(/Word files are not taken/)).toBeOnTheScreen();
    expect(within(guide).getByText("Internal · never shown to clients")).toBeOnTheScreen();
  });
});

describe("HotelDocumentsScreen: the library", () => {
  it("groups the documents by type, each with its version, kind, size and day", async () => {
    await renderLibrary({ documents: [factSheetFixture(), hotelDocumentFixture()] });
    expect(screen.getByRole("header", { name: "Fact sheets" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Food menus" })).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Floor plans" })).toBeNull();
    const menu = screen.getByTestId(`document-${DOCUMENT_ID}`);
    expect(within(menu).getByText("Banquet menu")).toBeOnTheScreen();
    expect(within(menu).getByText("Version 2 · PDF · 2.4 MB · 12 NOV 2026")).toBeOnTheScreen();
    expect(screen.getByText("2 of 100 documents")).toBeOnTheScreen();
  });

  it("opens a document's latest version through a minted 15-minute link, in a new tab", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const sent: SentRequest[] = [];
    const client = await renderLibrary({ documents: [hotelDocumentFixture()], sent });
    await fireEvent.press(screen.getByRole("button", { name: "Open Banquet menu" }));
    // The root-relative link is opened from the API base, not the app's own origin.
    await waitFor(() => expect(open).toHaveBeenCalledWith(`http://api.test${LINK_PATH}`));
    expect(sent).toEqual([
      {
        method: "POST",
        path: `${DOCUMENTS}/${DOCUMENT_ID}/link`,
        query: "",
        contentType: null,
        json: null,
      },
    ]);
    await untilSettled(client);
    open.mockRestore();
  });

  it("offers an Office file as a download, which is how the link serves it", async () => {
    await renderLibrary({ documents: [factSheetFixture()] });
    expect(screen.getByRole("button", { name: "Download Fact sheet" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Open Fact sheet" })).toBeNull();
    // One version only: no versions toggle.
    expect(screen.queryByRole("button", { name: /earlier version/ })).toBeNull();
  });

  it("shows the earlier versions on request, each opening through its own link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const sent: SentRequest[] = [];
    const client = await renderLibrary({ documents: [hotelDocumentFixture()], sent });
    const toggle = screen.getByRole("button", { name: "Show 1 earlier version" });
    expect(toggle).not.toBeExpanded();
    expect(screen.queryByText("Version 1")).toBeNull();
    await fireEvent.press(toggle);
    expect(screen.getByRole("button", { name: "Hide 1 earlier version" })).toBeExpanded();
    const earlier = screen.getByTestId(`document-version-${EARLIER_VERSION_ID}`);
    expect(within(earlier).getByText("Version 1")).toBeOnTheScreen();
    expect(within(earlier).getByText("Banquet menu 2025")).toBeOnTheScreen();
    expect(within(earlier).getByText("PDF · 1.2 MB · 3 OCT 2026")).toBeOnTheScreen();
    await fireEvent.press(
      within(earlier).getByRole("button", { name: "Open version 1 of Banquet menu" }),
    );
    await waitFor(() => expect(open).toHaveBeenCalledWith(`http://api.test${LINK_PATH}`));
    expect(sent.map((request) => request.path)).toEqual([
      `${DOCUMENTS}/${EARLIER_VERSION_ID}/link`,
    ]);
    await untilSettled(client);
    open.mockRestore();
  });

  it("deletes a document after a confirm that says every version goes", async () => {
    const sent: SentRequest[] = [];
    const client = await renderLibrary({ documents: [hotelDocumentFixture()], sent });
    await fireEvent.press(screen.getByRole("button", { name: "Delete Banquet menu" }));
    expect(await screen.findByText("Delete Banquet menu?")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "This deletes Banquet menu from the hotel with all 2 of its versions. Nobody can open them afterwards.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("document-delete-confirm"));
    expect(await screen.findByText("Banquet menu deleted")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "DELETE",
        path: `${DOCUMENTS}/${DOCUMENT_ID}`,
        query: "",
        contentType: null,
        json: null,
      },
    ]);
    await untilSettled(client);
  });
});

describe("HotelDocumentsScreen: a refused delete or link", () => {
  const newer = "A newer version of this document was filed since; reload and try again";
  const refusal = (code: string, message: string, status: number) => () =>
    jsonResponse({ error: { code, message } }, status);

  it("says why a delete was refused, closes the confirm and refreshes the list", async () => {
    let refused = false;
    const client = await renderLibrary({
      documents: () => [hotelDocumentFixture(refused ? { versionNumber: 3 } : {})],
      remove: () => {
        refused = true;
        return refusal("conflict", newer, 409)();
      },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Delete Banquet menu" }));
    await fireEvent.press(await screen.findByTestId("document-delete-confirm"));
    expect(await screen.findByText(newer)).toBeOnTheScreen();
    expect(screen.queryByText("Delete Banquet menu?")).toBeNull();
    expect(await screen.findByText("Version 3 · PDF · 2.4 MB · 12 NOV 2026")).toBeOnTheScreen();
    await untilSettled(client);
  });

  it("says why a document would not open, opens nothing and refreshes the list", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    let refused = false;
    const client = await renderLibrary({
      documents: () => [hotelDocumentFixture(refused ? { title: "Banquet menu 2027" } : {})],
      link: () => {
        refused = true;
        return refusal("not_found", "No such document", 404)();
      },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Open Banquet menu" }));
    expect(await screen.findByText("No such document")).toBeOnTheScreen();
    expect(await screen.findByText("Banquet menu 2027")).toBeOnTheScreen();
    expect(open).not.toHaveBeenCalled();
    await untilSettled(client);
    open.mockRestore();
  });
});
