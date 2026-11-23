import { Linking } from "react-native";

import type { StaffRole } from "@ampm/policy";
import type { WeddingReferenceView } from "@ampm/core";
import { pickFile } from "@ampm/ui";
import type * as UiModule from "@ampm/ui";

import { pendingFetch } from "../../test/api";
import { fireEvent, screen, waitFor, within } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelReferencesScreen } from "./hotel-references-screen";
import {
  CONSENT_DOCUMENT_ID,
  failure,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  ok,
  REFERENCE_ID,
  renderWithApi,
  routedFetch,
  weddingReferenceFixture,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  pickFile: jest.fn(),
}));

const REFERENCES = `/hotels-admin/hotels/${HOTEL_ID}/wedding-references`;
const REFERENCE = `${REFERENCES}/${REFERENCE_ID}`;
const LINK_PATH = "/documents/links/018f0000-0000-7000-8000-00000000a111/token";

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

const consented = (overrides: Partial<WeddingReferenceView> = {}) =>
  weddingReferenceFixture({ consentDocumentId: CONSENT_DOCUMENT_ID, ...overrides });

/** The References tab's API: the hotel, `/me` for the role, the list and the writes, each recorded. */
function referencesFetch(
  references: readonly WeddingReferenceView[],
  roles: readonly StaffRole[],
  sent: Sent[] = [],
): FetchFn {
  const record = (path: string, init: RequestInit | undefined): void => {
    const raw = init?.body;
    sent.push({
      method: init?.method ?? "GET",
      path,
      body: typeof raw === "string" ? JSON.parse(raw) : null,
    });
  };
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotelStaffDetailViewFixture()),
    "/me": () => ok(staffMeFixture([...roles])),
    [REFERENCES]: (init) => {
      if (init?.method !== "POST") return ok({ items: references });
      record(REFERENCES, init);
      return ok(weddingReferenceFixture());
    },
    [REFERENCE]: (init) => {
      record(REFERENCE, init);
      return init?.method === "DELETE" ? ok({ id: REFERENCE_ID }) : ok(consented());
    },
    [`${REFERENCE}/consent`]: (init) => {
      record(`${REFERENCE}/consent`, init);
      return ok(consented());
    },
    [`${REFERENCE}/consent/link`]: () =>
      ok({ url: LINK_PATH, expiresAt: "2026-11-23T12:15:00.000Z" }),
  });
}

async function renderTab(fetch: FetchFn) {
  await renderWithApi(<HotelReferencesScreen hotelId={HOTEL_ID} />, fetch);
}

const writes = (sent: readonly Sent[]) => sent.filter((request) => request.method !== "GET");

beforeEach(() => {
  jest.mocked(pickFile).mockReset();
});

describe("HotelReferencesScreen: states", () => {
  it("shows the loading state while the references load", async () => {
    await renderTab(pendingFetch);
    expect(await screen.findByTestId("references-loading")).toBeOnTheScreen();
  });

  it("shows an error with a retry when the references fail to load", async () => {
    await renderTab(routedFetch({ [REFERENCES]: () => failure("internal", 500) }));
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("offers the first reference to the Hotel team when there is none", async () => {
    await renderTab(referencesFetch([], ["HT"]));
    expect(await screen.findByText(/No past weddings yet/)).toBeOnTheScreen();
    expect(await screen.findByTestId("reference-section-add")).toBeOnTheScreen();
    expect(screen.getByText("None shown to clients yet")).toBeOnTheScreen();
  });
});

describe("HotelReferencesScreen: the Hotel team manages references", () => {
  it("adds a reference that starts internal", async () => {
    const sent: Sent[] = [];
    await renderTab(referencesFetch([], ["HT"], sent));
    await fireEvent.press(await screen.findByTestId("reference-section-add"));
    await fireEvent.changeText(await screen.findByTestId("reference-year"), "2023");
    await fireEvent.changeText(screen.getByTestId("reference-guests"), "150");
    await fireEvent.press(screen.getByTestId("reference-edit-submit"));
    expect(await screen.findByText("Reference added")).toBeOnTheScreen();
    expect(writes(sent)).toEqual([
      {
        method: "POST",
        path: REFERENCES,
        body: { eventYear: 2023, guestCount: 150, descriptionClient: null, clientVisible: false },
      },
    ]);
  });

  it("asks for the couple's consent before offering to show a reference", async () => {
    await renderTab(referencesFetch([weddingReferenceFixture()], ["HT"]));
    const row = await screen.findByTestId(`reference-${REFERENCE_ID}`);
    expect(within(row).getByText("2024 wedding")).toBeOnTheScreen();
    expect(within(row).getByText("320 guests")).toBeOnTheScreen();
    expect(within(row).getByText("Internal")).toBeOnTheScreen();
    expect(within(row).getByText("No consent yet")).toBeOnTheScreen();
    expect(within(row).getByText(/Attach the couple's consent/)).toBeOnTheScreen();
    expect(within(row).getByRole("button", { name: "Attach consent" })).toBeOnTheScreen();
    expect(within(row).queryByRole("button", { name: "Show to clients" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "View consent" })).toBeNull();
  });

  it("uploads the picked consent to the reference, narrowing the picker to PDF, JPEG and PNG", async () => {
    const sent: Sent[] = [];
    jest.mocked(pickFile).mockResolvedValue({
      file: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      mimeType: "application/pdf",
      sizeBytes: 2_048,
      name: "consent.pdf",
    });
    await renderTab(referencesFetch([weddingReferenceFixture()], ["HT"], sent));
    await fireEvent.press(await screen.findByTestId(`reference-${REFERENCE_ID}-attach`));
    expect(pickFile).toHaveBeenCalledWith("application/pdf,image/jpeg,image/png");
    await waitFor(() =>
      expect(writes(sent)).toEqual([
        { method: "POST", path: `${REFERENCE}/consent`, body: null }, // raw bytes, not JSON
      ]),
    );
    expect(await screen.findByText("Consent attached")).toBeOnTheScreen();
  });

  it("refuses a consent file over the limit without uploading it", async () => {
    const sent: Sent[] = [];
    jest.mocked(pickFile).mockResolvedValue({
      file: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      mimeType: "application/pdf",
      sizeBytes: 21 * 1024 * 1024,
      name: "consent.pdf",
    });
    await renderTab(referencesFetch([weddingReferenceFixture()], ["HT"], sent));
    await fireEvent.press(await screen.findByTestId(`reference-${REFERENCE_ID}-attach`));
    expect(await screen.findByText("This file is over the 20 MB limit")).toBeOnTheScreen();
    expect(writes(sent)).toEqual([]);
  });

  it("shows a consented reference to clients, and hides a shown one again", async () => {
    const sent: Sent[] = [];
    await renderTab(referencesFetch([consented()], ["HT"], sent));
    await fireEvent.press(await screen.findByRole("button", { name: "Show to clients" }));
    expect(await screen.findByText("Now shown to clients")).toBeOnTheScreen();
    expect(writes(sent)).toEqual([
      { method: "PATCH", path: REFERENCE, body: { clientVisible: true } },
    ]);
  });

  it("hides a reference clients see", async () => {
    const sent: Sent[] = [];
    await renderTab(referencesFetch([consented({ clientVisible: true })], ["HT"], sent));
    expect(await screen.findByText("1 of 1 shown to clients")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Hide from clients" }));
    expect(await screen.findByText("Hidden from clients")).toBeOnTheScreen();
    expect(writes(sent)).toEqual([
      { method: "PATCH", path: REFERENCE, body: { clientVisible: false } },
    ]);
  });

  it("removes a reference after confirming", async () => {
    const sent: Sent[] = [];
    await renderTab(referencesFetch([weddingReferenceFixture()], ["HT"], sent));
    await fireEvent.press(await screen.findByTestId(`reference-${REFERENCE_ID}-delete`));
    expect(await screen.findByText("Remove the 2024 wedding?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("reference-remove-confirm"));
    expect(await screen.findByText("The 2024 wedding was removed")).toBeOnTheScreen();
    expect(writes(sent)).toEqual([{ method: "DELETE", path: REFERENCE, body: null }]);
  });

  it("opens the editor seeded from a row", async () => {
    await renderTab(referencesFetch([weddingReferenceFixture()], ["HT"]));
    await fireEvent.press(await screen.findByTestId(`reference-${REFERENCE_ID}-edit`));
    expect(await screen.findByDisplayValue("A three-day lakeside celebration")).toBeOnTheScreen();
  });

  it("opens the consent on file through a minted link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderTab(referencesFetch([consented()], ["HT"]));
    const row = await screen.findByTestId(`reference-${REFERENCE_ID}`);
    await fireEvent.press(await within(row).findByRole("button", { name: "View consent" }));
    // The root-relative link is opened from the API base, not the app's own origin.
    await waitFor(() => expect(open).toHaveBeenCalledWith(`http://api.test${LINK_PATH}`));
    open.mockRestore();
  });
});

describe("HotelReferencesScreen: a Sales Manager reads references", () => {
  it("sees what clients see and whether consent is on file, but never opens it or changes anything", async () => {
    await renderTab(referencesFetch([consented({ clientVisible: true })], ["SM"]));
    const row = await screen.findByTestId(`reference-${REFERENCE_ID}`);
    expect(within(row).getByText("Shown to clients")).toBeOnTheScreen();
    expect(within(row).getByText("Consent on file")).toBeOnTheScreen();
    // The consent names the couple: the API refuses SM the link, so the row offers none.
    expect(within(row).queryByRole("button", { name: "View consent" })).toBeNull();
    expect(screen.queryByTestId("reference-section-add")).toBeNull();
    expect(within(row).queryByTestId(`reference-${REFERENCE_ID}-edit`)).toBeNull();
    expect(within(row).queryByTestId(`reference-${REFERENCE_ID}-delete`)).toBeNull();
    expect(within(row).queryByRole("button", { name: "Replace consent" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Hide from clients" })).toBeNull();
  });
});
