import type { StaffRoleCode } from "@ampm/core";

import { fireEvent, screen, within } from "../../test/render";
import { HotelDocumentsScreen } from "./hotel-documents-screen";
import {
  DOCUMENT_ID,
  documentsFetch,
  factSheetFixture,
  hotelDocumentFixture,
  untilSettled,
  type DocumentsApi,
  type SentRequest,
} from "./hotel-documents.test-utils";
import { HOTEL_ID, renderWithApi } from "./hotels-admin.test-utils";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

/** The tab once the hotel, `/me` (so the grants are known) and the list have all answered. */
async function renderAs(api: DocumentsApi) {
  const client = await renderWithApi(
    <HotelDocumentsScreen hotelId={HOTEL_ID} />,
    documentsFetch(api),
  );
  await untilSettled(client);
  return client;
}

/** The menu's row, and whether each of its actions is offered. */
function menuActions() {
  const row = within(screen.getByTestId(`document-${DOCUMENT_ID}`));
  const offered = (name: string) => row.queryByRole("button", { name }) !== null;
  return {
    open: offered("Open Banquet menu"),
    replace: offered("Replace Banquet menu"),
    remove: offered("Delete Banquet menu"),
    startCard: offered("Start draft F&B card from Banquet menu"),
    upload: screen.queryByTestId("documents-upload") !== null,
  };
}

beforeEach(() => jest.clearAllMocks());

describe("HotelDocumentsScreen: each action needs its grant (D-164)", () => {
  it("gives the Hotel team every action", async () => {
    await renderAs({ documents: [hotelDocumentFixture()], roles: ["HT"] });
    expect(menuActions()).toEqual({
      open: true,
      replace: true,
      remove: true,
      startCard: true,
      upload: true,
    });
  });

  it.each<StaffRoleCode>(["SM", "PM"])(
    "lets %s open documents and change nothing",
    async (role) => {
      await renderAs({ documents: [hotelDocumentFixture()], roles: [role] });
      expect(menuActions()).toEqual({
        open: true,
        replace: false,
        remove: false,
        startCard: false,
        upload: false,
      });
    },
  );

  it("offers the upload, but no Replace, to a custom role without the update grant", async () => {
    const capabilities = ["hotels.hotel_documents.read:all", "hotels.hotel_documents.create:all"];
    await renderAs({ documents: [hotelDocumentFixture()], roles: [], capabilities });
    expect(menuActions()).toMatchObject({ upload: true, replace: false, remove: false });
  });

  it("offers Replace to a custom role with the create and update grants", async () => {
    const capabilities = [
      "hotels.hotel_documents.read:all",
      "hotels.hotel_documents.create:all",
      "hotels.hotel_documents.update:all",
    ];
    await renderAs({ documents: [hotelDocumentFixture()], roles: [], capabilities });
    expect(menuActions()).toMatchObject({ upload: true, replace: true, remove: false });
  });

  it("offers Delete alone to a custom role with only the delete grant", async () => {
    const capabilities = ["hotels.hotel_documents.read:all", "hotels.hotel_documents.delete:all"];
    await renderAs({ documents: [hotelDocumentFixture()], roles: [], capabilities });
    expect(menuActions()).toEqual({
      open: true,
      replace: false,
      remove: true,
      startCard: false,
      upload: false,
    });
  });

  it("offers the draft F&B card only with the rate-card create grant", async () => {
    const capabilities = [
      "hotels.hotel_documents.read:all",
      "hotels.rate_cards_rate_items.create:all",
    ];
    await renderAs({ documents: [hotelDocumentFixture()], roles: [], capabilities });
    expect(menuActions()).toEqual({
      open: true,
      replace: false,
      remove: false,
      startCard: true,
      upload: false,
    });
  });
});

describe("HotelDocumentsScreen: a draft F&B card from a menu", () => {
  it("is offered on food and beverage menus, never on a fact sheet", async () => {
    const barList = hotelDocumentFixture({
      id: "018f0000-0000-7000-8000-0000000c1499",
      documentType: "beverage_menu",
      title: "Bar list",
      versions: [],
    });
    await renderAs({ documents: [factSheetFixture(), barList], roles: ["HT"] });
    expect(
      screen.getByRole("button", { name: "Start draft F&B card from Bar list" }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: /Start draft F&B card from Fact sheet/ }),
    ).toBeNull();
  });

  it("opens the rate-card sheet prefilled, creates a draft card and shows where it is", async () => {
    const sent: SentRequest[] = [];
    const source = `Food menu v2 (document ${DOCUMENT_ID})`;
    const client = await renderAs({ documents: [hotelDocumentFixture()], roles: ["HT"], sent });
    await fireEvent.press(
      screen.getByRole("button", { name: "Start draft F&B card from Banquet menu" }),
    );
    expect(await screen.findByText("New rate card")).toBeOnTheScreen();
    expect(screen.getByTestId("rate-card-name")).toHaveDisplayValue("F&B · Banquet menu");
    // The source is staff-only: it sits in the sheet's internal panel, naming the document and version.
    expect(screen.getByTestId("rate-card-source")).toHaveDisplayValue(source);
    await fireEvent.press(screen.getByTestId("rate-card-edit-submit"));
    expect(await screen.findByText("Draft F&B card started")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "POST",
        path: `/hotels-admin/hotels/${HOTEL_ID}/rate-cards`,
        query: "",
        contentType: "application/json",
        json: {
          name: "F&B · Banquet menu",
          validFrom: null,
          validTo: null,
          currency: "INR",
          source,
          internalNotes: null,
        },
      },
    ]);
    expect(
      screen.getByText(/F&B · Banquet menu is a draft on the Rate cards tab/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Open rate cards" }));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/hotels-admin/[hotelId]/rates",
      params: { hotelId: HOTEL_ID },
    });
    await untilSettled(client);
  });
});
