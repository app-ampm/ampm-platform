import type { MeResponse, SavedHotelView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { HotelsScreen } from "./hotels-screen";
import {
  clientMe,
  fail,
  fakeApi,
  hotelFixture,
  JAIPUR,
  ok,
  pageOf,
  renderWithApi,
  savedFixture,
  savedIds,
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
    if (url.pathname === "/hotels/saved/ids") return ok(savedIds(saved.map((s) => s.hotel.id)));
    if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf(saved));
    if (method === "POST" && url.pathname === `/hotels/${PAVILION.id}/save`)
      return { status: 201, body: { data: savedFixture(PAVILION, SAVED_ID) } };
    return undefined;
  });
}

/** A second hotel in a different destination, so the compare pick (B12b) has two cards to choose from. */
const HAVELI = hotelFixture({
  id: "018f0000-0000-7000-8000-00000000cafe",
  slug: "amber-haveli-jaipur",
  name: "Amber Haveli",
  destination: JAIPUR,
});

/**
 * Discovery with two hotels and a save endpoint that accepts either: comparing a browse card saves the
 * picks before the compare opens (B12b), so these POSTs stand in for that step; `failSave` makes them 500.
 */
function compareApi(me: MeResponse, { failSave = false }: { readonly failSave?: boolean } = {}) {
  return fakeApi((method, url) => {
    if (url.pathname === "/me") return ok(me);
    if (method === "GET" && url.pathname === "/hotels") return ok(pageOf([PAVILION, HAVELI]));
    if (url.pathname === "/hotels/saved/ids") return ok(savedIds([]));
    if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf([]));
    if (method === "POST" && /^\/hotels\/[^/]+\/save$/.test(url.pathname)) {
      if (failSave) return fail("internal", 500);
      const hotel = url.pathname.includes(HAVELI.id) ? HAVELI : PAVILION;
      return { status: 201, body: { data: savedFixture(hotel, SAVED_ID) } };
    }
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

  it("reads saved state from the complete ids set, even when the first shortlist page omits the hotel", async () => {
    // The bug this fixes: isSaved used to scan the first page of /hotels/saved, so a hotel saved further
    // down showed as unsaved. The heart now reads the complete /hotels/saved/ids set.
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(SUBSCRIBER);
      if (method === "GET" && url.pathname === "/hotels") return ok(pageOf([PAVILION]));
      if (url.pathname === "/hotels/saved/ids") return ok(savedIds([PAVILION.id])); // saved, per the set
      if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf([])); // but not on page one
      return undefined;
    });
    await renderWithApi(<HotelsScreen />, api.fetch);
    expect(
      await screen.findByRole("button", { name: "The Lake Pavilion saved to shortlist" }),
    ).toBeOnTheScreen();
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

describe("HotelResults — compare on cards (B12b)", () => {
  it("shows the Compare toggle when the account can save and two or more hotels are shown", async () => {
    await renderWithApi(<HotelsScreen />, compareApi(SUBSCRIBER).fetch);
    expect(await screen.findByRole("button", { name: "Compare" })).toBeOnTheScreen();
  });

  it("offers no Compare toggle to an account that may browse but not save", async () => {
    await renderWithApi(<HotelsScreen />, compareApi(BROWSE_ONLY).fetch);
    // The cards still render; only the compare (and save) affordance is withheld.
    await screen.findByRole("button", { name: /The Lake Pavilion in Udaipur/ });
    expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();
  });

  it("offers no Compare toggle when fewer than two hotels are shown", async () => {
    await renderWithApi(<HotelsScreen />, discovery(SUBSCRIBER).fetch);
    await screen.findByRole("button", { name: /The Lake Pavilion in Udaipur/ });
    expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();
  });

  it("saves the two picks, then opens the side-by-side with them", async () => {
    const api = compareApi(SUBSCRIBER);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    await fireEvent.press(await screen.findByTestId(`compare-select-${PAVILION.id}`));
    await fireEvent.press(screen.getByTestId(`compare-select-${HAVELI.id}`));
    // In compare mode the toggle reads "Cancel", so this "Compare" is the picker's action.
    await fireEvent.press(screen.getByRole("button", { name: "Compare" }));
    // The compare opens only after both picks are saved (the compare endpoint returns only saved hotels).
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/hotels/compare",
        params: { ids: `${PAVILION.id},${HAVELI.id}` },
      }),
    );
    expect(api.calls).toContain(`POST /hotels/${PAVILION.id}/save`);
    expect(api.calls).toContain(`POST /hotels/${HAVELI.id}/save`);
  });

  it("warns and keeps the picks when a save fails, without opening compare", async () => {
    await renderWithApi(<HotelsScreen />, compareApi(SUBSCRIBER, { failSave: true }).fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    await fireEvent.press(await screen.findByTestId(`compare-select-${PAVILION.id}`));
    await fireEvent.press(screen.getByTestId(`compare-select-${HAVELI.id}`));
    await fireEvent.press(screen.getByRole("button", { name: "Compare" }));
    expect(await screen.findByText("Could not add those hotels to compare")).toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();
    // Dismiss so the toast's timer doesn't outlive the test.
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.dismiss }));
  });
});
