import { hasErrors } from "./hotel-form-fields";
import { roomCategoryViewFixture } from "./hotels-admin.test-utils";
import {
  buildRoomBody,
  draftFromRoom,
  ROOM_FIELD_ORDER,
  roomUpdateBody,
  validateRoom,
  type RoomDraft,
} from "./rooms.form";

const filled: RoomDraft = {
  name: "Synthetic Garden Suite",
  unitType: "suite",
  viewLabel: "Garden view",
  bedConfiguration: "King",
  roomCount: "8",
  maxOccupancy: "3",
  sizeSqm: "",
  sizeSqft: "650",
  facilities: "wifi, minibar\nBalcony | Bathtub",
  description: "",
};

describe("rooms.form", () => {
  it("seeds an edit from the room category, its facilities one per line", () => {
    const room = roomCategoryViewFixture({ unitType: "villa", sizeSqft: 484, viewLabel: "Lake" });
    expect(draftFromRoom(room)).toEqual({
      name: "Deluxe Lake View",
      unitType: "villa",
      viewLabel: "Lake",
      bedConfiguration: "",
      roomCount: "20",
      maxOccupancy: "3",
      sizeSqm: "45",
      sizeSqft: "484",
      facilities: "wifi\nminibar",
      description: "",
    });
  });

  it("starts a new room category blank, its unit type not set", () => {
    expect(draftFromRoom(null)).toMatchObject({ name: "", unitType: "unset", sizeSqft: "" });
  });

  it("names the missing name and refuses a max occupancy of 0", () => {
    const errors = validateRoom({ ...draftFromRoom(null), maxOccupancy: "0" });
    expect(errors.name).toBe("Give the room category a name");
    expect(errors.maxOccupancy).toBe("Max occupancy is a whole number from 1 to 100");
    expect(validateRoom({ ...filled, maxOccupancy: "1" }).maxOccupancy).toBeUndefined();
    expect(validateRoom({ ...filled, maxOccupancy: "101" }).maxOccupancy).toBeDefined();
    expect(validateRoom({ ...filled, roomCount: "100001" }).roomCount).toBe(
      "Rooms is a whole number, up to 100,000",
    );
    expect(hasErrors(validateRoom(filled))).toBe(false);
    expect(ROOM_FIELD_ORDER[0]).toBe("name");
  });

  // A comma stays inside an entry (one rule with the import), so a comma list pasted on one line is one
  // facility: the contract takes 100 of at most 120 characters, and the sheet must say so before a save.
  it("holds the facilities to the contract's 100 entries of 120 characters, naming the field", () => {
    const commaList = Array.from({ length: 12 }, (_, i) => `Synthetic amenity ${i}`).join(", ");
    expect(commaList.length).toBeGreaterThan(120);
    expect(validateRoom({ ...filled, facilities: commaList }).facilities).toBe(
      "Each facility is at most 120 characters; put each one on its own line",
    );
    const many = Array.from({ length: 101 }, (_, i) => `Synthetic amenity ${i}`).join("\n");
    expect(validateRoom({ ...filled, facilities: many }).facilities).toBe(
      "Keep to 100 facilities, one per line",
    );
    expect(validateRoom({ ...filled, facilities: "x".repeat(120) }).facilities).toBeUndefined();
    expect(ROOM_FIELD_ORDER).toContain("facilities");
  });

  it("checks the m² only while there is no sq ft", () => {
    expect(validateRoom({ ...filled, sizeSqm: "abc" }).sizeSqm).toBeUndefined();
    expect(validateRoom({ ...filled, sizeSqm: "abc", sizeSqft: "" }).sizeSqm).toBe(
      "Size in m² is a whole number, up to 100,000",
    );
    expect(validateRoom({ ...filled, sizeSqft: "1.5" }).sizeSqft).toBeDefined();
  });

  it("builds the body: the m² worked out from the sq ft, facilities split per line or |, never at a comma", () => {
    expect(buildRoomBody(filled)).toEqual({
      name: "Synthetic Garden Suite",
      unitType: "suite",
      viewLabel: "Garden view",
      bedConfiguration: "King",
      roomCount: 8,
      maxOccupancy: 3,
      sizeSqm: 60,
      sizeSqft: 650,
      facilities: ["wifi, minibar", "Balcony", "Bathtub"],
      description: null,
    });
  });

  it("sends Not set as null, a typed m² with no sq ft, and empty lists as null", () => {
    const body = buildRoomBody({ ...filled, unitType: "unset", sizeSqm: "45", sizeSqft: "" });
    expect(body).toMatchObject({ unitType: null, sizeSqm: 45, sizeSqft: null });
    expect(buildRoomBody({ ...filled, facilities: " \n | " }).facilities).toBeNull();
  });

  it("updates only what changed, so a save keeps what an import wrote meanwhile", () => {
    const room = roomCategoryViewFixture();
    expect(roomUpdateBody(draftFromRoom(room), room)).toEqual({});
    expect(roomUpdateBody({ ...draftFromRoom(room), roomCount: "25" }, room)).toEqual({
      roomCount: 25,
    });
    expect(roomUpdateBody({ ...draftFromRoom(room), sizeSqft: "484" }, room)).toEqual({
      sizeSqft: 484,
    });
  });
});
