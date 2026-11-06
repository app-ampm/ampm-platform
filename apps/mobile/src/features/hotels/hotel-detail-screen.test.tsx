import { QueryClient } from "@tanstack/react-query";

import { ApiProvider } from "@ampm/api-client";
import { uiCopy } from "@ampm/ui";

import { renderWithProviders, screen } from "../../test/render";
import { HotelDetailScreen } from "./hotel-detail-screen";

// The screen reads the router (back button, sign-in redirect); a plain stub is enough here.
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

const HOTEL_ID = "018f0000-0000-7000-8000-00000000beef";

// The exact shape `GET /hotels/:id` returns: the client card plus the detail's rates, gallery and
// references. The hook must parse this with `hotelDetailView`; the strict card schema `hotelView`
// rejects these three keys and throws (the bug this test guards — see use-hotel.ts).
const DETAIL = {
  id: HOTEL_ID,
  slug: "lake-pavilion-udaipur",
  name: "The Lake Pavilion",
  brand: null,
  starCategory: "5",
  destination: {
    id: "018f0000-0000-7000-8000-000000000000",
    name: "Udaipur",
    slug: "udaipur",
    region: null,
    state: "Rajasthan",
    country: "India",
  },
  address: "Lake Road, Udaipur",
  description: "A heritage-style lakeside palace for destination weddings.",
  website: null,
  totalRooms: 84,
  streetViewRef: null,
  lastVerifiedAt: null,
  rates: { status: "on_request", asOf: null, items: [] },
  gallery: [],
  references: [],
};

type FetchFn = typeof fetch;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

/**
 * A fetch that serves the detail payload for this hotel and 404s everything else. The screen's save
 * button also reads `/me` and the saved list; letting those 404 keeps the button hidden (a handled
 * denial) so the test stays focused on the detail itself.
 */
function detailFetch(detail: unknown): FetchFn {
  return (input) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.endsWith(`/hotels/${HOTEL_ID}`))
      return Promise.resolve(jsonResponse({ data: detail }, 200));
    return Promise.resolve(
      jsonResponse({ error: { code: "not_found", message: "Not found" } }, 404),
    );
  };
}

// Retries off so the error states resolve immediately, with no backoff wait; gcTime Infinity so React
// Query schedules no cache-GC timer (its 5-minute default keeps Jest's event loop alive long after the
// tests have passed, stalling the run before the process exits).
async function renderScreen(fetchImpl: FetchFn): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await renderWithProviders(
    <ApiProvider baseUrl="http://api.test" fetch={fetchImpl} queryClient={queryClient}>
      <HotelDetailScreen hotelId={HOTEL_ID} />
    </ApiProvider>,
  );
}

describe("HotelDetailScreen", () => {
  it("shows the loading skeleton while the hotel is pending", async () => {
    await renderScreen(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("hotel-detail-loading")).toBeOnTheScreen();
  });

  it("renders the hotel once the detail payload loads, parsed as the detail shape", async () => {
    await renderScreen(detailFetch(DETAIL));
    // The name appearing (not the error state) proves the hook parsed the rates/gallery/references
    // payload with hotelDetailView rather than throwing on the strict card schema.
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(screen.getByText("Udaipur, Rajasthan")).toBeOnTheScreen();
    expect(screen.queryByText(uiCopy.error.title)).toBeNull();
  });

  it("shows the not-found empty state when the hotel is outside the client's reach", async () => {
    await renderScreen(() =>
      Promise.resolve(jsonResponse({ error: { code: "not_found", message: "x" } }, 404)),
    );
    expect(await screen.findByText("Hotel not found")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderScreen(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });
});
