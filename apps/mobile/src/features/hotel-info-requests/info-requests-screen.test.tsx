import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { InfoRequestsScreen } from "./info-requests-screen";
import {
  newHotelRequestFixture,
  NEW_REQUEST_ID,
  ok,
  renderWithApi,
  requestSummaryFixture,
  staffMeFixture,
  type FetchFn,
} from "./info-requests.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useCanGoBack: () => true,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

type Roles = ReturnType<typeof staffMeFixture>["roles"];

const LIVE = requestSummaryFixture();
const NEW_HOTEL = newHotelRequestFixture();
const SECOND_ID = "018f0000-0000-7000-8000-0000000c2003";

interface Api {
  readonly fetch: FetchFn;
  /** The query of every inbox page asked for. */
  readonly inbox: string[];
}

/** The inbox (two rows, or what `pages` answers by cursor), a new hotel's detail, and `/me`. */
function queueApi(
  roles: Roles = ["HT"],
  page: (search: URLSearchParams) => unknown = () => ({
    items: [LIVE, NEW_HOTEL],
    nextCursor: null,
  }),
): Api {
  const api: Api = {
    inbox: [],
    fetch: (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/me") return Promise.resolve(ok(staffMeFixture(roles)));
      if (url.pathname === "/hotels-admin/info-requests") {
        api.inbox.push(url.search);
        return Promise.resolve(ok(page(url.searchParams)));
      }
      if (url.pathname === `/hotels-admin/info-requests/${NEW_REQUEST_ID}`) {
        return Promise.resolve(ok(NEW_HOTEL));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    },
  };
  return api;
}

beforeEach(() => {
  mockPush.mockClear();
});

describe("InfoRequestsScreen (TW-99)", () => {
  it("lists the requests and opens a hotel's record from its row", async () => {
    await renderWithApi(<InfoRequestsScreen />, queueApi().fetch);
    await fireEvent.press(
      await screen.findByLabelText("HIR-2026-0001, The Lakeside Palace, Udaipur, open"),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels-admin/[hotelId]/details",
      params: { hotelId: LIVE.hotelId },
    });
  });

  it("shows a new hotel's proposed name and destination, and opens its request on a sheet", async () => {
    await renderWithApi(<InfoRequestsScreen />, queueApi(["PM"]).fetch);
    const row = await screen.findByLabelText("HIR-2026-0002, The Desert Fort, Jaisalmer, open");
    expect(screen.getByText("Jaisalmer · New hotel")).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(await screen.findByTestId("request-card")).toBeOnTheScreen();
    expect(screen.getByTestId("request-proposed-hotel")).toHaveTextContent(
      "The Desert Fort · Jaisalmer · https://desert-fort.example",
    );
    expect(mockPush).not.toHaveBeenCalled();
    // A Project Manager reads the summary: no action on the sheet.
    expect(screen.queryByTestId("request-actions")).toBeNull();
  });

  it("asks the API for the status and round chosen, and for every request again", async () => {
    const api = queueApi();
    await renderWithApi(<InfoRequestsScreen />, api.fetch);
    await screen.findByTestId("requests-table");
    await fireEvent.press(screen.getByTestId("requests-status-submitted"));
    await waitFor(() => expect(api.inbox).toContain("?status=submitted"));
    await fireEvent.press(screen.getByTestId("requests-kind-refresh"));
    await waitFor(() => expect(api.inbox).toContain("?status=submitted&kind=refresh"));
    await fireEvent.press(screen.getByTestId("requests-status-all"));
    await waitFor(() => expect(api.inbox).toContain("?kind=refresh"));
  });

  it("lets the Super Admin show the test requests", async () => {
    const api = queueApi(["SA"]);
    await renderWithApi(<InfoRequestsScreen />, api.fetch);
    await fireEvent.press(await screen.findByTestId("requests-tests"));
    await waitFor(() => expect(api.inbox).toContain("?includeTests=true"));
  });

  it("offers the Hotel team no test requests switch", async () => {
    await renderWithApi(<InfoRequestsScreen />, queueApi(["HT"]).fetch);
    await screen.findByTestId("requests-table");
    expect(screen.queryByTestId("requests-tests")).toBeNull();
  });

  it("loads the next page from the footer", async () => {
    const second = requestSummaryFixture({ id: SECOND_ID, reference: "HIR-2026-0003" });
    const api = queueApi(["HT"], (search) =>
      search.get("cursor")
        ? { items: [second], nextCursor: null }
        : { items: [LIVE], nextCursor: LIVE.id },
    );
    await renderWithApi(<InfoRequestsScreen />, api.fetch);
    await fireEvent.press(await screen.findByTestId("requests-load-more"));
    expect(await screen.findByLabelText(/^HIR-2026-0003/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^HIR-2026-0001/)).toBeOnTheScreen();
    expect(screen.queryByTestId("requests-load-more")).toBeNull();
  });

  it("says when there is no request yet, and when the filters match none", async () => {
    const api = queueApi(["HT"], () => ({ items: [], nextCursor: null }));
    await renderWithApi(<InfoRequestsScreen />, api.fetch);
    expect(await screen.findByText("No information requests yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("requests-status-revoked"));
    expect(await screen.findByText("No requests match these filters")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Show every request"));
    expect(await screen.findByText("No information requests yet")).toBeOnTheScreen();
  });

  it("shows the error state when the inbox fails", async () => {
    const fetch: FetchFn = (input) =>
      Promise.resolve(
        new URL(String(input)).pathname === "/me"
          ? ok(staffMeFixture(["HT"]))
          : new Response(JSON.stringify({ error: { code: "internal", message: "x" } }), {
              status: 500,
            }),
      );
    await renderWithApi(<InfoRequestsScreen />, fetch);
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });
});
