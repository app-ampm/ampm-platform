import { screen } from "../../test/render";
import { DestinationHotelsScreen } from "./destination-hotels-screen";
import { fakeApi, hotelFixture, ok, pageOf, renderWithApi } from "./hotels.test-utils";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
}));

const PAVILION = hotelFixture();
const DEST_ID = "018f0000-0000-7000-8000-000000000000";

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
});

describe("DestinationHotelsScreen", () => {
  it("lists the destination's hotels under its name, filtered to it", async () => {
    const api = fakeApi((method, url) =>
      method === "GET" && url.pathname === "/hotels" ? ok(pageOf([PAVILION])) : undefined,
    );
    await renderWithApi(
      <DestinationHotelsScreen destinationId={DEST_ID} destinationName="Udaipur" />,
      api.fetch,
    );
    expect(await screen.findByRole("header", { name: "Udaipur" })).toBeOnTheScreen();
    expect(
      await screen.findByRole("button", { name: "The Lake Pavilion in Udaipur, Rajasthan" }),
    ).toBeOnTheScreen();
    expect(api.calls.some((call) => call.includes(`destinationId=${DEST_ID}`))).toBe(true);
  });
});
