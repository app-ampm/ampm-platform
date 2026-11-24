import { fireEvent, screen } from "../../test/render";
import { RoomEditSheet } from "./room-edit-sheet";
import {
  HOTEL_ID,
  ok,
  renderWithApi,
  ROOM_ID,
  roomCategoryViewFixture,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

interface Captured {
  created?: unknown;
  updated?: unknown;
}

function roomFetch(captured: Captured): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}/rooms`]: (init) => {
      captured.created = JSON.parse(String(init?.body));
      return ok(roomCategoryViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/rooms/${ROOM_ID}`]: (init) => {
      captured.updated = JSON.parse(String(init?.body));
      return ok(roomCategoryViewFixture());
    },
  });
}

const noop = (): void => {};

async function renderNew(captured: Captured): Promise<void> {
  await renderWithApi(
    <RoomEditSheet hotelId={HOTEL_ID} open room={null} onClose={noop} />,
    roomFetch(captured),
  );
}

describe("RoomEditSheet", () => {
  it("adds a room category: its unit type, view, beds and facilities one per line", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("room-name"), "Synthetic Garden Suite");
    await fireEvent.press(screen.getByTestId("room-unit-type-suite"));
    await fireEvent.changeText(screen.getByTestId("room-view"), "Garden view");
    await fireEvent.changeText(screen.getByTestId("room-bed"), "King or twin");
    await fireEvent.changeText(screen.getByTestId("room-count"), "8");
    await fireEvent.changeText(screen.getByTestId("room-facilities"), "wifi, minibar\nBalcony");
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Room category added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      name: "Synthetic Garden Suite",
      unitType: "suite",
      viewLabel: "Garden view",
      bedConfiguration: "King or twin",
      roomCount: 8,
      facilities: ["wifi, minibar", "Balcony"],
    });
  });

  it("works the m² out from the sq ft, read-only, and sends both", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("room-name"), "Synthetic Tent");
    await fireEvent.changeText(screen.getByTestId("room-size"), "70");
    expect(screen.getByTestId("room-size")).toHaveDisplayValue("70");
    await fireEvent.changeText(screen.getByTestId("room-size-sqft"), "650");
    expect(screen.getByTestId("room-size")).toHaveDisplayValue("60");
    expect(screen.getByTestId("room-size")).toBeDisabled();
    expect(screen.getByText("Worked out from sq ft")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Room category added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({ sizeSqm: 60, sizeSqft: 650 });
  });

  it("gives the m² back to type once the sq ft is emptied", async () => {
    await renderNew({});
    await fireEvent.changeText(await screen.findByTestId("room-size"), "70");
    await fireEvent.changeText(screen.getByTestId("room-size-sqft"), "650");
    await fireEvent.changeText(screen.getByTestId("room-size-sqft"), "");
    expect(screen.getByTestId("room-size")).toHaveDisplayValue("70");
    expect(screen.getByTestId("room-size")).toBeEnabled();
    expect(screen.queryByText("Worked out from sq ft")).toBeNull();
  });

  it("blocks a save with no name or a max occupancy of 0, naming the first in a toast", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("room-occupancy"), "0");
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Check the highlighted fields")).toBeOnTheScreen();
    expect(screen.getByText("Name: Give the room category a name")).toBeOnTheScreen();
    expect(screen.getByText("Give the room category a name")).toBeOnTheScreen();
    expect(screen.getByText("Max occupancy is a whole number from 1 to 100")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  // The API refuses an entry over 120 characters with a bare "Validation failed"; the sheet must name the
  // field first, since a comma list pasted on one line stays one entry.
  it("blocks a save whose facilities line is too long, naming Facilities", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    const commaList = Array.from({ length: 12 }, (_, i) => `Synthetic amenity ${i}`).join(", ");
    await fireEvent.changeText(await screen.findByTestId("room-name"), "Synthetic Garden Suite");
    await fireEvent.changeText(screen.getByTestId("room-facilities"), commaList);
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    const message = "Each facility is at most 120 characters; put each one on its own line";
    expect(await screen.findByText(`Facilities: ${message}`)).toBeOnTheScreen();
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a room category: seeds from it and sends only the change", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RoomEditSheet hotelId={HOTEL_ID} open room={roomCategoryViewFixture()} onClose={noop} />,
      roomFetch(captured),
    );
    await screen.findByDisplayValue("Deluxe Lake View");
    expect(screen.getByTestId("room-facilities")).toHaveDisplayValue("wifi\nminibar");
    expect(screen.getByTestId("room-unit-type-unset")).toBeChecked();
    await fireEvent.changeText(screen.getByTestId("room-count"), "25");
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Room category updated")).toBeOnTheScreen();
    expect(captured.updated).toEqual({ roomCount: 25 });
  });
});
