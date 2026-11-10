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

describe("RoomEditSheet", () => {
  it("adds a room category: fills the fields and posts the body", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RoomEditSheet hotelId={HOTEL_ID} open room={null} onClose={noop} />,
      roomFetch(captured),
    );
    await fireEvent.changeText(await screen.findByTestId("room-name"), "Garden Suite");
    await fireEvent.changeText(screen.getByTestId("room-count"), "8");
    await fireEvent.changeText(screen.getByTestId("room-facilities"), "wifi, balcony");
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Room category added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      name: "Garden Suite",
      roomCount: 8,
      facilities: ["wifi", "balcony"],
    });
  });

  it("blocks submit and names the missing name", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RoomEditSheet hotelId={HOTEL_ID} open room={null} onClose={noop} />,
      roomFetch(captured),
    );
    await fireEvent.press(await screen.findByTestId("room-edit-submit"));
    expect(await screen.findByText("Give the room category a name")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a room category: seeds from it and patches the change", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RoomEditSheet hotelId={HOTEL_ID} open room={roomCategoryViewFixture()} onClose={noop} />,
      roomFetch(captured),
    );
    await screen.findByDisplayValue("Deluxe Lake View");
    await fireEvent.changeText(screen.getByTestId("room-count"), "25");
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Room category updated")).toBeOnTheScreen();
    expect(captured.updated).toMatchObject({ name: "Deluxe Lake View", roomCount: 25 });
  });
});
