import type { MeResponse, SavedHotelView } from "@ampm/core";

import { fireEvent, screen, waitFor } from "../../test/render";
import { HotelsScreen } from "./hotels-screen";
import {
  clientMe,
  fakeApi,
  hotelFixture,
  ok,
  pageOf,
  renderWithApi,
  savedFixture,
} from "./hotels.test-utils";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: jest.fn(),
    push: mockPush,
    dismissTo: jest.fn(),
  }),
}));

const PAVILION = hotelFixture();
/** A saved-hotel row id (a real UUID, as the schema requires) for the shortlist fixture. */
const SAVED_ID = "018f0000-0000-7000-8000-0000000005ed";
/** A subscriber who holds hotel discovery AND a shortlist, so a card shows its save heart (B12). */
const SUBSCRIBER = clientMe(["hotel_discovery", "saved_hotels"]);
/** An account that may browse but keeps no shortlist, so no heart is offered. */
const BROWSE_ONLY = clientMe(["hotel_discovery"]);

/** `/me`, one hotel on `GET /hotels`, the shortlist, and the save endpoint the heart calls. */
function discovery(me: MeResponse, saved: readonly SavedHotelView[] = []) {
  return fakeApi((method, url) => {
    if (url.pathname === "/me") return ok(me);
    if (method === "GET" && url.pathname === "/hotels") return ok(pageOf([PAVILION]));
    if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf(saved));
    if (method === "POST" && url.pathname === `/hotels/${PAVILION.id}/save`)
      return { status: 201, body: { data: savedFixture(PAVILION, SAVED_ID) } };
    return undefined;
  });
}

beforeEach(() => mockPush.mockClear());

describe("HotelResults — save heart on a result card (B12)", () => {
  it("shows a hotel-named save heart on the card when the account keeps a shortlist", async () => {
    await renderWithApi(<HotelsScreen />, discovery(SUBSCRIBER).fetch);
    // The name is in the label (WCAG 2.4.4), so one heart per card is distinguishable in a list.
    expect(await screen.findByRole("button", { name: "Save The Lake Pavilion" })).toBeOnTheScreen();
  });

  it("already-saved hotel shows the heart as saved, not as 'Save'", async () => {
    await renderWithApi(
      <HotelsScreen />,
      discovery(SUBSCRIBER, [savedFixture(PAVILION, SAVED_ID)]).fetch,
    );
    // Wait for the card (and so the heart) to mount before the shortlist settles the saved state.
    await screen.findByRole("button", { name: /The Lake Pavilion in Udaipur/ });
    expect(
      await screen.findByRole("button", { name: "The Lake Pavilion saved to shortlist" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save The Lake Pavilion" })).toBeNull();
  });

  it("omits the heart for an account that may browse but not save", async () => {
    await renderWithApi(<HotelsScreen />, discovery(BROWSE_ONLY).fetch);
    // The card itself still renders (its accessible name carries the hotel and its card summary).
    expect(
      await screen.findByRole("button", { name: /The Lake Pavilion in Udaipur/ }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save The Lake Pavilion" })).toBeNull();
  });

  it("saves the hotel when the heart is pressed, without opening the card", async () => {
    const api = discovery(SUBSCRIBER);
    await renderWithApi(<HotelsScreen />, api.fetch);
    fireEvent.press(await screen.findByRole("button", { name: "Save The Lake Pavilion" }));
    await waitFor(() => expect(api.calls).toContain(`POST /hotels/${PAVILION.id}/save`));
    // The heart is a sibling of the pressable card, so saving never navigates to the hotel.
    expect(mockPush).not.toHaveBeenCalled();
  });
});
