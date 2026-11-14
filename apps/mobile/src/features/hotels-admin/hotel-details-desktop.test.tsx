import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { HotelDetailsScreen } from "./hotel-details-screen";
import {
  CONTACT_ID,
  destinationViewFixture,
  HOTEL_ID,
  hotelContactViewFixture,
  hotelStaffDetailViewFixture,
  ok,
  renderWithApi,
  roomCategoryViewFixture,
  routedFetch,
  venueViewFixture,
} from "./hotels-admin.test-utils";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does (a plain width mock lets React Compiler skip the render).
 */
const mockWindow = { width: 1440, listeners: new Set<() => void>() };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  const subscribe = (listener: () => void) => {
    mockWindow.listeners.add(listener);
    return () => mockWindow.listeners.delete(listener);
  };
  return {
    __esModule: true,
    default: function useMockWindowDimensions() {
      const width = react.useSyncExternalStore(subscribe, () => mockWindow.width);
      return { width, height: 900, scale: 2, fontScale: 1 };
    },
  };
});

async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

async function renderDetails(): Promise<void> {
  const detail = hotelStaffDetailViewFixture({
    rooms: [roomCategoryViewFixture()],
    venues: [venueViewFixture()],
    contacts: [hotelContactViewFixture()],
  });
  const fetchImpl = routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(detail),
    "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
  });
  await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, fetchImpl);
  await screen.findByTestId("details-split");
}

const summary = () => screen.getByTestId(`contact-${CONTACT_ID}-summary`);

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 1440;
});

describe("HotelDetailsScreen from 1024 (T5)", () => {
  it("sets rooms and venues beside the restricted contacts, whose note stays in view", async () => {
    await renderDetails();
    expect(screen.getByTestId("details-split").props.className).toContain("flex-row");
    const contacts = screen.getByTestId("hotel-contacts-column");
    expect(within(contacts).getByText("Priya Sharma")).toBeOnTheScreen();
    expect(within(contacts).getByText("Never shown to clients")).toBeOnTheScreen();
    expect(within(contacts).queryByText("Deluxe Lake View")).toBeNull();
    expect(screen.getByRole("tab", { name: "Rooms, venues & contacts" })).toBeSelected();
  });

  it("lets a contact's role, phone and email wrap in the side column, and not on a phone", async () => {
    await renderDetails();
    expect(summary().props.numberOfLines).toBe(3);
    await resizeTo(390);
    expect(summary().props.numberOfLines).toBe(1);
    expect(screen.getByTestId("details-split").props.className).toContain("flex-col");
  });

  it("keeps a contact being written when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderDetails();
    await fireEvent.press(screen.getByTestId("contact-section-add"));
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Ravi Mehta");
    await resizeTo(1440);
    expect(screen.getByTestId("details-split").props.className).toContain("flex-row");
    expect(screen.getByTestId("contact-name")).toHaveDisplayValue("Ravi Mehta");
    await resizeTo(390);
    expect(screen.getByTestId("contact-name")).toHaveDisplayValue("Ravi Mehta");
  });

  it("keeps a room being written when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderDetails();
    await fireEvent.press(screen.getByTestId("room-section-add"));
    await fireEvent.changeText(await screen.findByTestId("room-name"), "Garden Suite");
    await resizeTo(1440);
    expect(screen.getByTestId("room-name")).toHaveDisplayValue("Garden Suite");
    await resizeTo(390);
    expect(screen.getByTestId("room-name")).toHaveDisplayValue("Garden Suite");
  });
});
