import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { HotelDetailScreen } from "./hotel-detail-screen";
import {
  detailFixture,
  fail,
  fakeApi,
  HOTEL_ID,
  offlineFetch,
  ok,
  pendingFetch,
  renderWithApi,
} from "./hotels.test-utils";

const mockBack = jest.fn();

// The screen reads the router (back button, sign-in redirect); a plain stub is enough here.
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
}));

// The exact shape `GET /hotels/:id` returns: the client card plus the detail's rates, gallery and
// references. The hook must parse this with `hotelDetailView`; the strict card schema `hotelView`
// rejects these three keys and throws (the bug this test guards — see use-hotel.ts).
const DETAIL = detailFixture();

/**
 * Serves the detail payload for this hotel and 404s everything else. The save button also reads `/me`
 * and the saved list; letting those 404 keeps it hidden (a handled denial) so the tests stay on the
 * detail itself.
 */
function detailApi(detail: unknown) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === `/hotels/${HOTEL_ID}` ? ok(detail) : undefined,
  );
}

async function renderScreen(fetchImpl: typeof fetch): Promise<void> {
  await renderWithApi(<HotelDetailScreen hotelId={HOTEL_ID} />, fetchImpl);
}

beforeEach(() => mockBack.mockClear());

describe("HotelDetailScreen", () => {
  it("shows the loading skeleton while the hotel is pending, with the back button live", async () => {
    await renderScreen(pendingFetch);
    expect(screen.getByTestId("hotel-detail-loading")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.screenHeader.back }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("renders the hotel once the detail payload loads, parsed as the detail shape", async () => {
    await renderScreen(detailApi(DETAIL).fetch);
    // The name appearing (not the error state) proves the hook parsed the rates/gallery/references
    // payload with hotelDetailView rather than throwing on the strict card schema.
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(screen.getByText("Udaipur, Rajasthan")).toBeOnTheScreen();
    expect(screen.queryByText(uiCopy.error.title)).toBeNull();
  });

  it("titles the glass panel in Gilda Display and lists the hotel's facts as chips", async () => {
    await renderScreen(detailApi(DETAIL).fetch);
    const title = await screen.findByRole("header", { name: "The Lake Pavilion" });
    expect(String(title.props.className)).toContain("font-display");
    expect(screen.getByLabelText("5-star")).toBeOnTheScreen();
    expect(screen.getByLabelText("84 rooms")).toBeOnTheScreen();
    expect(screen.getByRole("image", { name: "Hotel photo · Udaipur" })).toBeOnTheScreen();
  });

  it("offers tabs only for the sections the API sent, opening on the overview", async () => {
    await renderScreen(detailApi(DETAIL).fetch);
    expect(await screen.findByRole("tab", { name: "Overview" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Rates" })).toBeOnTheScreen();
    expect(screen.queryByRole("tab", { name: /Gallery/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Weddings/ })).toBeNull();
    expect(screen.getByText(DETAIL.description ?? "")).toBeOnTheScreen();
    expect(screen.getByText("Lake Road, Udaipur")).toBeOnTheScreen();
  });

  it("shows rates on request without amounts, in the rates tab and the sticky footer", async () => {
    await renderScreen(detailApi(DETAIL).fetch);
    await fireEvent.press(await screen.findByRole("tab", { name: "Rates" }));
    expect(screen.getByLabelText("Rates on request")).toBeOnTheScreen();
    expect(screen.getByText("Prices for this hotel are shared on request.")).toBeOnTheScreen();
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it("goes back from the hero's glass button", async () => {
    await renderScreen(detailApi(DETAIL).fetch);
    await screen.findByText("The Lake Pavilion");
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.screenHeader.back }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("shows the not-found empty state when the hotel is outside the client's reach", async () => {
    await renderScreen(fakeApi(() => fail("not_found", 404)).fetch);
    expect(await screen.findByText("Hotel not found")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: uiCopy.screenHeader.back })).toBeOnTheScreen();
  });

  it("asks a signed-out client to sign in", async () => {
    await renderScreen(fakeApi(() => fail("unauthenticated", 401)).fetch);
    expect(await screen.findByText("Sign in to view this hotel")).toBeOnTheScreen();
  });

  it("shows the retryable error state when the API fails", async () => {
    await renderScreen(fakeApi(() => fail("internal", 500)).fetch);
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderScreen(offlineFetch);
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });
});
