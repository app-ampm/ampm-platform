import type { RateItemCreateRequest } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import type { AuditService } from "../../policy/audit.service.js";
import type { ConfigService } from "../admin/config/config.service.js";
import type { HotelRatesRepository, RateItemRow } from "./hotel-rates.repository.js";
import { HotelRatesService } from "./hotel-rates.service.js";
import type { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";
import { CARD_ID, ITEM_ID } from "./testing/rate-plan-fixtures.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import { ROOM_ID, roomRow, VENUE_ID, venueRow } from "./testing/subresource-fixtures.js";

/*
 * A staff rate item belongs to its card's hotel (D-184, §5): a room category or venue it names must be a
 * live one of that hotel, answered on its own field with the same words for one that exists nowhere, so
 * nothing leaks; and an item is for a room category or a venue, not both, an update checked against the
 * stored item merged with its patch. Fakes only; the database side is test/hotel-rate-items.e2e-spec.ts.
 */

const ACTOR = "018f0000-0000-7000-8000-00000000cafe";
const ELSEWHERE = "0192f1a0-0000-7000-8000-0000000000e7";
const NOT_BOTH = "An item is for a room category or a venue, not both";
const inr = (minor: number) => ({ minor, currency: "INR" as const });

const itemRow = (overrides: Partial<RateItemRow> = {}): RateItemRow => ({
  id: ITEM_ID,
  rateCardId: CARD_ID,
  itemType: "room_rate",
  roomCategoryId: null,
  venueId: null,
  amount: new Prisma.Decimal("12500.00"),
  amountMax: null,
  isIndicative: true,
  unit: "per_night",
  minQuantity: null,
  inclusionsText: null,
  clientVisible: false,
  ...overrides,
});

/** The service over fakes: the hotel has one live room and one live venue; the stored item is given. */
function build(
  stored: { roomCategoryId: string | null; venueId: string | null } = {
    roomCategoryId: null,
    venueId: null,
  },
) {
  const repo = {
    findCardInHotel: vi.fn(async () => ({ id: CARD_ID, status: "draft" })),
    findItemInCard: vi.fn(async () => ({ id: ITEM_ID, ...stored })),
    createItem: vi.fn(async () => itemRow()),
    updateItem: vi.fn(async () => itemRow()),
  };
  const subresources = {
    findRoomInHotel: vi.fn(async (hotelId: string, id: string) =>
      hotelId === HOTEL_ID && id === ROOM_ID ? roomRow() : null,
    ),
    findVenueInHotel: vi.fn(async (hotelId: string, id: string) =>
      hotelId === HOTEL_ID && id === VENUE_ID ? venueRow() : null,
    ),
  };
  const audit = { record: vi.fn(async () => {}) };
  const service = new HotelRatesService(
    repo as unknown as HotelRatesRepository,
    audit as unknown as AuditService,
    {} as unknown as ConfigService,
    subresources as unknown as HotelSubresourcesRepository,
  );
  return { service, repo, subresources };
}

const create = (fields: Partial<RateItemCreateRequest>): RateItemCreateRequest => ({
  itemType: "room_rate",
  amount: inr(1_250_000),
  isIndicative: true,
  unit: "per_night",
  clientVisible: false,
  ...fields,
});

describe("HotelRatesService.addItem: the item belongs to its card's hotel", () => {
  it("adds an item for a live room or venue of the hotel, or for neither", async () => {
    const { service, repo } = build();
    await service.addItem(HOTEL_ID, CARD_ID, create({ roomCategoryId: ROOM_ID }), ACTOR);
    await service.addItem(HOTEL_ID, CARD_ID, create({ venueId: VENUE_ID }), ACTOR);
    await service.addItem(HOTEL_ID, CARD_ID, create({}), ACTOR);
    expect(repo.createItem).toHaveBeenCalledTimes(3);
  });

  it("refuses another hotel's room or venue, and an id that exists nowhere, in the same words", async () => {
    const { service, repo } = build();
    for (const [fields, path, message] of [
      [{ roomCategoryId: ELSEWHERE }, "roomCategoryId", "Choose a room category of this hotel"],
      [{ venueId: ELSEWHERE }, "venueId", "Choose a venue of this hotel"],
    ] as const) {
      await expect(service.addItem(HOTEL_ID, CARD_ID, create(fields), ACTOR)).rejects.toMatchObject(
        {
          code: "validation_failed",
          details: [{ path, message }],
        },
      );
    }
    expect(repo.createItem).not.toHaveBeenCalled();
  });

  it("refuses an item for a room category and a venue at once, on both fields", async () => {
    const { service, repo, subresources } = build();
    const both = create({ roomCategoryId: ROOM_ID, venueId: VENUE_ID });
    await expect(service.addItem(HOTEL_ID, CARD_ID, both, ACTOR)).rejects.toMatchObject({
      code: "validation_failed",
      details: [
        { path: "roomCategoryId", message: NOT_BOTH },
        { path: "venueId", message: NOT_BOTH },
      ],
    });
    expect(subresources.findRoomInHotel).not.toHaveBeenCalled();
    expect(repo.createItem).not.toHaveBeenCalled();
  });
});

describe("HotelRatesService.updateItem: the stored item merged with the patch", () => {
  it("refuses a venue on an item for a room, on the field the patch set", async () => {
    const { service, repo } = build({ roomCategoryId: ROOM_ID, venueId: null });
    await expect(
      service.updateItem(HOTEL_ID, CARD_ID, ITEM_ID, { venueId: VENUE_ID }, ACTOR),
    ).rejects.toMatchObject({ details: [{ path: "venueId", message: NOT_BOTH }] });
    expect(repo.updateItem).not.toHaveBeenCalled();
  });

  it("moves an item from its room to a venue of the hotel when the patch clears the room", async () => {
    const { service, repo } = build({ roomCategoryId: ROOM_ID, venueId: null });
    await service.updateItem(
      HOTEL_ID,
      CARD_ID,
      ITEM_ID,
      { roomCategoryId: null, venueId: VENUE_ID },
      ACTOR,
    );
    expect(repo.updateItem).toHaveBeenCalledOnce();
  });

  // The staff sheet sends an item's stored links back with every edit. A room or venue removed since
  // (a soft delete keeps the id) is no longer a live one of the hotel, yet re-sending it changes nothing,
  // so the edit must save; only a link the patch changes is checked.
  it("saves an edit that sends back the stored link of a room removed since", async () => {
    const removed = "0192f1a0-0000-7000-8000-0000000000e8";
    const { service, repo, subresources } = build({ roomCategoryId: removed, venueId: null });
    const patch = { roomCategoryId: removed, venueId: null, amount: inr(1_300_000) };
    await service.updateItem(HOTEL_ID, CARD_ID, ITEM_ID, patch, ACTOR);
    expect(repo.updateItem).toHaveBeenCalledOnce();
    expect(subresources.findRoomInHotel).not.toHaveBeenCalled();
  });

  it("saves an edit that sends back both stored links of an older item that holds both", async () => {
    const { service, repo } = build({ roomCategoryId: ROOM_ID, venueId: VENUE_ID });
    const patch = { roomCategoryId: ROOM_ID, venueId: VENUE_ID, minQuantity: 20 };
    await service.updateItem(HOTEL_ID, CARD_ID, ITEM_ID, patch, ACTOR);
    expect(repo.updateItem).toHaveBeenCalledOnce();
  });

  it("refuses another hotel's room, and checks nothing the patch leaves alone", async () => {
    const { service, subresources } = build({ roomCategoryId: ROOM_ID, venueId: null });
    await expect(
      service.updateItem(HOTEL_ID, CARD_ID, ITEM_ID, { roomCategoryId: ELSEWHERE }, ACTOR),
    ).rejects.toMatchObject({
      details: [{ path: "roomCategoryId", message: "Choose a room category of this hotel" }],
    });
    subresources.findRoomInHotel.mockClear();
    await service.updateItem(HOTEL_ID, CARD_ID, ITEM_ID, { amount: inr(1_300_000) }, ACTOR);
    expect(subresources.findRoomInHotel).not.toHaveBeenCalled();
  });
});
