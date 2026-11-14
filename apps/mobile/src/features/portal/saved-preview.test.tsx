import { fireEvent, screen } from "../../test/render";
import {
  fakeApi,
  hotelFixture,
  offlineFetch,
  ok,
  pendingFetch,
  renderWithApi,
  savedFixture,
} from "../hotels/hotels.test-utils";
import { SavedPreview } from "./saved-preview";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const ENTRY = savedFixture(hotelFixture(), "018f0000-0000-7000-8000-0000000000a1");

function savedApi(items: readonly unknown[]) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === "/hotels/saved"
      ? ok({ items, nextCursor: null })
      : undefined,
  );
}

beforeEach(() => mockPush.mockClear());

describe("SavedPreview (home, B16)", () => {
  it("shows recent saved hotels as cards and links to the full shortlist", async () => {
    await renderWithApi(<SavedPreview />, savedApi([ENTRY]).fetch);
    const card = await screen.findByRole("button", {
      name: /The Lake Pavilion in Udaipur, Rajasthan/,
    });
    await fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/[id]",
      params: { id: ENTRY.hotel.id },
    });
    await fireEvent.press(screen.getByRole("button", { name: "See all" }));
    expect(mockPush).toHaveBeenLastCalledWith("/hotels/saved");
  });

  it("falls back to the shortlist prompt when nothing is saved", async () => {
    await renderWithApi(<SavedPreview />, savedApi([]).fetch);
    expect(
      await screen.findByText("Save a hotel from discovery to build your shortlist."),
    ).toBeOnTheScreen();
  });

  it("announces a loading skeleton while the shortlist loads", async () => {
    await renderWithApi(<SavedPreview />, pendingFetch);
    expect(screen.getByTestId("saved-preview-loading")).toBeOnTheScreen();
  });

  it("falls back to the shortlist link on an error, keeping a way in", async () => {
    await renderWithApi(<SavedPreview />, offlineFetch);
    expect(await screen.findByText("Open your shortlist.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /Saved hotels/ }));
    expect(mockPush).toHaveBeenCalledWith("/hotels/saved");
  });
});
