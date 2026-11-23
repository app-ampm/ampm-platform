import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import {
  allowedCuisines,
  checkPostalCode,
  CUISINE_REFUSED,
  KEPT_POSTAL_CODE_REFUSED,
  keptPostalCodeProblem,
  resolveCuisines,
} from "./hotel-profile-rules.js";
import {
  buildHotelsAdminService as build,
  CUISINE_OPTIONS,
  DESTINATION_ID,
  HOTEL_ID,
} from "./testing/staff-hotel-fixtures.js";

const HT = staffPrincipal(["HT"]);
const OTHER_DESTINATION = "0192f1a0-0000-7000-8000-0000000000a9";
const CREATE = {
  destinationId: DESTINATION_ID,
  name: "Second Synthetic Hotel",
  status: "draft",
  demoVisible: false,
  publicShowcase: false,
} as const;

describe("the profile rules (D-178)", () => {
  it("checks a postal code against its destination's country, spaces removed", () => {
    expect(checkPostalCode("313 001", "India")).toEqual({ postalCode: "313001", problem: null });
    expect(checkPostalCode("013001", "India").problem).toMatch(/6 digits/);
    expect(checkPostalCode("SW1A 1AA", "United Kingdom")).toEqual({
      postalCode: "SW1A1AA",
      problem: null,
    });
  });

  it("checks the code a moving hotel keeps against its new country, and none when it has none", () => {
    expect(keptPostalCodeProblem("SW1A1AA", "India")).toBe(KEPT_POSTAL_CODE_REFUSED);
    expect(keptPostalCodeProblem("313001", "India")).toBeNull();
    expect(keptPostalCodeProblem("SW1A1AA", "United Kingdom")).toBeNull();
    expect(keptPostalCodeProblem(null, "India")).toBeNull();
  });

  it("matches cuisines to their allowed spelling and names the unknown ones", () => {
    const allowed = allowedCuisines(CUISINE_OPTIONS, ["Goan"]);
    expect(resolveCuisines(["indian", "goan", "other", "Thai"], allowed)).toEqual({
      labels: ["Indian", "Goan", "Other", "Thai"],
      unknown: [3],
    });
  });

  it("prefers the configured spelling over a stored one that differs only in case", () => {
    expect(resolveCuisines(["INDIAN"], allowedCuisines(["Indian"], ["indian"])).labels).toEqual([
      "Indian",
    ]);
  });
});

describe("HotelsAdminService writes the D-178 fields", () => {
  it("refuses a PIN that breaks the India rule on create, naming the field, before any write", async () => {
    const { service, repo } = build();
    await expect(service.create({ ...CREATE, postalCode: "31300" }, HT)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "postalCode", message: expect.stringMatching(/6 digits/) }],
    });
    expect(repo.createHotel).not.toHaveBeenCalled();
  });

  it("stores a PIN without its spaces and cuisines in their configured spelling", async () => {
    const { service, repo } = build();
    await service.create({ ...CREATE, postalCode: "313 001", cuisines: ["indian", "Other"] }, HT);
    expect(repo.createHotel).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: "313001", cuisines: ["Indian", "Other"] }),
      expect.any(String),
    );
  });

  it("refuses a cuisine outside the configuration with its index as the path", async () => {
    const { service, repo } = build();
    const request = { cuisines: ["Indian", "Martian"] };
    await expect(service.update(HOTEL_ID, request, HT)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "cuisines.1", message: CUISINE_REFUSED }],
    });
    expect(repo.updateHotel).not.toHaveBeenCalled();
  });

  it("keeps a label the hotel already carries, though the configuration no longer offers it", async () => {
    const { service, repo } = build({ cuisines: ["Goan"] });
    await service.update(HOTEL_ID, { cuisines: ["Goan", "Indian"] }, HT);
    expect(repo.updateHotel).toHaveBeenCalledOnce();
  });

  it("checks a PIN on update against the current destination, looking it up only when one is sent", async () => {
    const { service, repo } = build();
    await service.update(HOTEL_ID, { minNights: 2 }, HT);
    expect(repo.findDestinationById).not.toHaveBeenCalled();
    await expect(service.update(HOTEL_ID, { postalCode: "012345" }, HT)).rejects.toMatchObject({
      details: [{ path: "postalCode" }],
    });
    expect(repo.findDestinationById).toHaveBeenCalledWith(DESTINATION_ID);
  });

  it("checks the PIN a hotel keeps when an update moves it to another destination", async () => {
    const { service, repo } = build({ postalCode: "SW1A1AA" });
    const india = { ...(await repo.findDestinationById(DESTINATION_ID)), id: OTHER_DESTINATION };
    repo.findDestinationById.mockImplementation(async (id: string) =>
      id === OTHER_DESTINATION
        ? india
        : { ...india, id: DESTINATION_ID, country: "United Kingdom" },
    );
    await expect(
      service.update(HOTEL_ID, { destinationId: OTHER_DESTINATION }, HT),
    ).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "postalCode", message: KEPT_POSTAL_CODE_REFUSED }],
    });
    expect(repo.updateHotel).not.toHaveBeenCalled();
    await service.update(HOTEL_ID, { destinationId: OTHER_DESTINATION, postalCode: "313001" }, HT);
    await service.update(HOTEL_ID, { destinationId: DESTINATION_ID }, HT);
    expect(repo.updateHotel).toHaveBeenCalledTimes(2);
  });

  it("writes only the fields an update names; a null clears one", async () => {
    const { service, repo } = build();
    await service.update(HOTEL_ID, { minNights: 2, bookingNotes: null }, HT);
    const [, patch] = repo.updateHotel.mock.calls[0] ?? [];
    expect(patch).toEqual({ minNights: 2, bookingNotes: null });
  });

  it("answers the staff editor's cuisine choices with the label for anything else", async () => {
    const { service } = build();
    await expect(service.cuisineOptions()).resolves.toEqual({
      options: CUISINE_OPTIONS,
      other: "Other",
    });
  });
});
