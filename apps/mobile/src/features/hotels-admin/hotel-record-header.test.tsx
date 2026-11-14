import { fireEvent, screen } from "../../test/render";
import { HotelRecordHeader } from "./hotel-record-header";
import type { HotelRecordSection } from "./hotel-record.format";
import {
  destinationViewFixture,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  ok,
  renderWithApi,
  routedFetch,
} from "./hotels-admin.test-utils";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1440, height: 900, scale: 2, fontScale: 1 }),
}));

const destinationsFetch = routedFetch({
  "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
});

async function renderHeader(section: HotelRecordSection, loaded = true): Promise<void> {
  const hotel = loaded ? hotelStaffDetailViewFixture() : undefined;
  await renderWithApi(
    <HotelRecordHeader hotelId={HOTEL_ID} section={section} hotel={hotel} />,
    destinationsFetch,
  );
}

beforeEach(() => jest.clearAllMocks());

describe("HotelRecordHeader (T5)", () => {
  it("titles the record with the hotel's name under its destination", async () => {
    await renderHeader("rates");
    expect(screen.getByRole("header", { name: "The Lakeside Palace" })).toBeOnTheScreen();
    expect(screen.getByText("Hotels · Udaipur")).toBeOnTheScreen();
    // Not the section's name: the tab strip says which section this is.
    expect(screen.queryByRole("header", { name: "Rate cards" })).toBeNull();
  });

  it("selects this page's tab in an underline strip of the three record sections", async () => {
    await renderHeader("rates");
    expect(screen.getByRole("tab", { name: "Rate cards" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Rooms, venues & contacts" })).not.toBeSelected();
    expect(screen.getByRole("tab", { name: "Media" })).not.toBeSelected();
    // The underline strip has no pill track around its tabs.
    expect(screen.getByTestId("hotel-record-tabs").props.className).not.toContain("rounded-full");
  });

  it("replaces the page with another section's, so back still leads to the catalogue", async () => {
    await renderHeader("media");
    await fireEvent.press(screen.getByRole("tab", { name: "Rooms, venues & contacts" }));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: "/hotels-admin/[hotelId]/details",
      params: { hotelId: HOTEL_ID },
    });
    await fireEvent.press(screen.getByRole("tab", { name: "Rate cards" }));
    expect(mockRouter.replace).toHaveBeenLastCalledWith({
      pathname: "/hotels-admin/[hotelId]/rates",
      params: { hotelId: HOTEL_ID },
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("stays put when the open section's tab is pressed", async () => {
    await renderHeader("media");
    await fireEvent.press(screen.getByRole("tab", { name: "Media" }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("goes back to the catalogue", async () => {
    await renderHeader("details");
    await fireEvent.press(screen.getByRole("button", { name: "Back to hotels" }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/hotels-admin");
  });

  it("opens the profile editor from the record's actions", async () => {
    await renderHeader("details");
    await fireEvent.press(screen.getByTestId("hotel-edit-profile"));
    expect(await screen.findByDisplayValue("The Lakeside Palace")).toBeOnTheScreen();
  });

  it("names no hotel and offers no profile edit until the hotel has loaded", async () => {
    await renderHeader("details", false);
    expect(screen.getByRole("header", { name: "Hotel" })).toBeOnTheScreen();
    expect(screen.getByText("Hotels")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-edit-profile")).toBeNull();
  });
});
