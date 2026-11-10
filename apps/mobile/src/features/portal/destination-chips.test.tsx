import type { DestinationBrowseItem } from "@ampm/core";

import { fireEvent, screen, waitFor } from "../../test/render";
import { fakeApi, JAIPUR, ok, renderWithApi, UDAIPUR } from "../hotels/hotels.test-utils";
import { DestinationChips } from "./destination-chips";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const UDAIPUR_D: DestinationBrowseItem = { ...UDAIPUR, hotelCount: 2 };
const JAIPUR_D: DestinationBrowseItem = { ...JAIPUR, hotelCount: 1 };

function destinationsApi(items: readonly DestinationBrowseItem[]) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === "/hotels/destinations" ? ok({ items }) : undefined,
  );
}

beforeEach(() => mockPush.mockClear());

describe("DestinationChips (home, B16)", () => {
  it("shows a chip per reachable destination and opens one's hotels", async () => {
    await renderWithApi(<DestinationChips />, destinationsApi([UDAIPUR_D, JAIPUR_D]).fetch);
    expect(await screen.findByText("Explore destinations")).toBeOnTheScreen();
    // The chip collapses its label + count into one button name ("Udaipur, 2").
    expect(await screen.findByRole("button", { name: /Udaipur/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Jaipur/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /Udaipur/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/destinations/[id]",
      params: { id: UDAIPUR.id, name: "Udaipur" },
    });
  });

  it("renders nothing while loading or when the account reaches no destinations", async () => {
    await renderWithApi(<DestinationChips />, destinationsApi([]).fetch);
    await waitFor(() => expect(screen.queryByText("Explore destinations")).toBeNull());
  });
});
