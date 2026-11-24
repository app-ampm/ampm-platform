import { SEARCH_DEBOUNCE_MS } from "@ampm/ui";
import type * as UiModule from "@ampm/ui";

import { act, fireEvent, screen, waitFor } from "../../test/render";
import { InviteHotelSheet } from "./invite-hotel-sheet";
import {
  destinationListItemFixture,
  duplicateHintFixture,
  ISSUED_URL,
  linkIssuedFixture,
  newHotelRequestFixture,
  ok,
  renderWithApi,
  staffMeFixture,
  type FetchFn,
} from "./info-requests.test-utils";

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  copyText: () => Promise.resolve(true),
  shareText: null,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const DESTINATION_ID = destinationListItemFixture().id;
const HINT = duplicateHintFixture();
const DELETED = duplicateHintFixture({
  hotelId: "018f0000-0000-7000-8000-0000000c0004",
  name: "Desert Fort Annexe",
  reasons: ["web_address"],
  deletedAt: "2026-11-01T10:00:00.000Z",
});

interface Api {
  readonly fetch: FetchFn;
  readonly hintQueries: string[];
  created?: unknown;
}

function inviteApi(roles: ReturnType<typeof staffMeFixture>["roles"] = ["HT"]): Api {
  const api: Api = {
    hintQueries: [],
    fetch: (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/me") return Promise.resolve(ok(staffMeFixture(roles)));
      if (url.pathname === "/hotels-admin/hotel-form-mode")
        return Promise.resolve(ok({ mode: "on" }));
      if (url.pathname === "/hotels-admin/destinations") {
        return Promise.resolve(ok({ items: [destinationListItemFixture()] }));
      }
      if (url.pathname === "/hotels-admin/hotel-duplicate-hints") {
        api.hintQueries.push(url.search);
        return Promise.resolve(ok({ hints: [HINT, DELETED] }));
      }
      if (url.pathname === "/hotels-admin/info-requests") {
        api.created = JSON.parse(String(init?.body));
        return Promise.resolve(ok(linkIssuedFixture({ request: newHotelRequestFixture() })));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    },
  };
  return api;
}

const noop = (): void => {};

describe("InviteHotelSheet", () => {
  it("asks for the hotel's name, destination and web address", async () => {
    const api = inviteApi();
    await renderWithApi(<InviteHotelSheet open onClose={noop} />, api.fetch);
    await fireEvent.press(await screen.findByTestId("invite-hotel-submit"));
    expect(await screen.findByText("Enter the hotel's name")).toBeOnTheScreen();
    expect(screen.getByText("Choose the hotel's destination")).toBeOnTheScreen();
    expect(
      screen.getByText("Enter a web address such as https://www.hotel.example"),
    ).toBeOnTheScreen();
    expect(api.created).toBeUndefined();
  });

  it("hints catalogue hotels once the typing pauses, and opens a live one's record", async () => {
    const api = inviteApi();
    const onClose = jest.fn();
    const onOpenHotel = jest.fn();
    await renderWithApi(
      <InviteHotelSheet open onClose={onClose} onOpenHotel={onOpenHotel} />,
      api.fetch,
    );
    const field = await screen.findByTestId("invite-hotel-name");
    jest.useFakeTimers();
    try {
      for (const typed of ["Th", "The D", "The Desert Fort"])
        await fireEvent.changeText(field, typed);
      await act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
      expect(api.hintQueries).toEqual([]);
      await act(() => jest.advanceTimersByTime(1));
    } finally {
      jest.useRealTimers();
    }
    await waitFor(() => expect(api.hintQueries).toEqual(["?name=The+Desert+Fort"]));
    expect(await screen.findByText("2 hotels in the catalogue may be this one")).toBeOnTheScreen();
    expect(screen.getByText("Same name")).toBeOnTheScreen();
    expect(screen.getByText("Same web address · Deleted 1 Nov 2026")).toBeOnTheScreen();
    expect(screen.queryByTestId(`duplicate-hint-${DELETED.hotelId}-open`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`duplicate-hint-${HINT.hotelId}-open`));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenHotel).toHaveBeenCalledWith(HINT.hotelId);
  });

  it("asks nothing of the catalogue for a letter or two", async () => {
    const api = inviteApi();
    await renderWithApi(<InviteHotelSheet open onClose={noop} />, api.fetch);
    await fireEvent.changeText(await screen.findByTestId("invite-hotel-name"), "Th");
    await act(() => new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50)));
    expect(api.hintQueries).toEqual([]);
    expect(screen.queryByTestId("duplicate-hints")).toBeNull();
  });

  it("creates the request for the proposed hotel, as its onboarding, and shows the link once", async () => {
    const api = inviteApi(["SA"]);
    await renderWithApi(<InviteHotelSheet open onClose={noop} />, api.fetch);
    await fireEvent.changeText(await screen.findByTestId("invite-hotel-name"), "The Desert Fort");
    await fireEvent.press(await screen.findByTestId("hotel-destination"));
    await fireEvent.press(await screen.findByTestId(`hotel-destination-option-${DESTINATION_ID}`));
    await fireEvent.changeText(
      screen.getByTestId("invite-hotel-web-address"),
      "desert-fort.example",
    );
    await fireEvent.press(screen.getByTestId("request-is-test"));
    await fireEvent.press(screen.getByTestId("invite-hotel-submit"));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    expect(screen.getByText("HIR-2026-0002 · The Desert Fort")).toBeOnTheScreen();
    expect(api.created).toEqual({
      target: "new",
      proposedName: "The Desert Fort",
      proposedDestinationId: DESTINATION_ID,
      proposedWebAddress: "desert-fort.example",
      emailIt: false,
      isTest: true,
    });
    // No share sheet in this browser: Copy alone.
    expect(screen.getByTestId("issued-link-copy")).toBeOnTheScreen();
    expect(screen.queryByTestId("issued-link-share")).toBeNull();
  });
});
