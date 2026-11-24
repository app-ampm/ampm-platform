import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { readStoredPlan } from "./hotel-import.job.js";
import { RATES_IMPORT } from "./hotel-import.kinds.js";
import { rateCardVersion, rateItemVersion } from "./hotel-import.version.js";
import {
  buildImportService,
  csv,
  NEW_CARD_ID,
  NEW_ROW_ID,
} from "./testing/import-service-fixtures.js";
import { rateCardRow, rateItemRow } from "./testing/rate-import-fixtures.js";
import { CARD_ID, CARD_NAME, ITEM_ID, ROOM_NAME } from "./testing/rate-plan-fixtures.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import { ROOM_ID, roomRow } from "./testing/subresource-fixtures.js";

/*
 * Previewing and importing a Rates file over fakes (D-184, Slice 4): a preview writes nothing but its job,
 * whose plan keeps each row with the version token of the item it matched, or of the stored card it adds an
 * item to; an import creates each new draft card first, then its items, then the stored cards' new and
 * changed items, each audited by the fields it sets, never their values. Synthetic data only.
 */

const HT = staffPrincipal(["HT"]);
const HEADER = "hotelSlug,cardName,validFrom,validTo,itemType,roomName,amount,amountMax,unit";
const NEW_CARD = "Synthetic season 2028";
const LAKE = "synthetic-lake-hotel";
const KEPT = `${LAKE},${CARD_NAME},,,Room rate,${ROOM_NAME},"12,500",,`;
const CHANGED = `${LAKE},${CARD_NAME},,,Room rate,${ROOM_NAME},13000,,`;
const ADDED = `${LAKE},${CARD_NAME},,,Tax,,18,,percent`;
const FRESH = `${LAKE},${NEW_CARD},2028-04-01,2029-03-31,Per plate veg,,"1,800",,per plate`;
const inr = (minor: number) => ({ minor, currency: "INR" });

function built() {
  return buildImportService({ rooms: [roomRow()], rateCards: [rateCardRow()] });
}

describe("previewing a rates file", () => {
  it("writes nothing but its job, reporting each row's card and item", async () => {
    const service = built();
    const preview = await service.service.preview("rates", csv(HEADER, KEPT, CHANGED, FRESH), HT);
    expect(preview).toMatchObject({ kind: "rates", dryRun: true, created: 1, updated: 0 });
    expect(preview.rows).toEqual([
      {
        line: 2,
        slug: LAKE,
        name: CARD_NAME,
        outcome: "unchanged",
        changedFields: [],
        item: { itemType: "room_rate", roomName: ROOM_NAME, venueName: null },
      },
      {
        line: 3,
        slug: LAKE,
        name: CARD_NAME,
        outcome: "error",
        changedFields: [],
        item: { itemType: "room_rate", roomName: ROOM_NAME, venueName: null },
      },
      {
        line: 4,
        slug: LAKE,
        name: NEW_CARD,
        outcome: "create",
        changedFields: ["cardName", "validFrom", "validTo", "itemType", "amount", "unit"],
        item: { itemType: "per_plate_veg", roomName: null, venueName: null },
      },
    ]);
    expect(preview.rejected).toEqual([
      { line: 3, errors: [{ field: "itemType", message: "Line 2 already names this item" }] },
    ]);
    expect(service.ratesRepo.createCard).not.toHaveBeenCalled();
    expect(service.ratesRepo.createItem).not.toHaveBeenCalled();
    expect(service.imports.recordPreview).toHaveBeenCalledWith(
      "hotel_rates",
      HT.userId,
      expect.objectContaining({ status: "validating", rowCount: 3 }),
    );
  });

  it("keeps each row with its target's token: the item it matched, the card it adds to, or none", async () => {
    const service = built();
    const { importJobId } = await service.service.preview(
      "rates",
      csv(HEADER, CHANGED, ADDED, FRESH),
      HT,
    );
    const plan = readStoredPlan(
      service.imports.jobs.get(importJobId)?.planJson ?? null,
      RATES_IMPORT,
    );
    expect(plan?.rows.map(({ line, target }) => [line, target])).toEqual([
      [2, { id: ITEM_ID, version: rateItemVersion(rateItemRow()) }],
      [3, { id: CARD_ID, version: rateCardVersion(rateCardRow()) }],
      [4, null],
    ]);
  });
});

describe("importing a rates preview", () => {
  it("creates the new card and its hidden item, adds and changes the stored card's, each audited", async () => {
    const service = built();
    const { importJobId } = await service.service.preview(
      "rates",
      csv(HEADER, CHANGED, ADDED, FRESH),
      HT,
    );
    const result = await service.service.apply("rates", importJobId, HT);
    expect(result).toMatchObject({ applied: true, created: 2, updated: 1, rejected: [] });
    expect(service.ratesRepo.createCard).toHaveBeenCalledWith(
      HOTEL_ID,
      { name: NEW_CARD, validFrom: "2028-04-01", validTo: "2029-03-31", currency: "INR" },
      HT.userId,
      expect.anything(),
    );
    expect(service.ratesRepo.createItem.mock.calls.map(([cardId, data]) => [cardId, data])).toEqual(
      [
        [
          NEW_CARD_ID,
          expect.objectContaining({
            itemType: "per_plate_veg",
            amount: inr(180_000),
            clientVisible: false,
          }),
        ],
        [
          CARD_ID,
          expect.objectContaining({ itemType: "tax", amount: inr(1_800), unit: "percent" }),
        ],
      ],
    );
    expect(service.ratesRepo.updateItem).toHaveBeenCalledWith(
      ITEM_ID,
      { amount: inr(1_300_000) },
      HT.userId,
      expect.anything(),
    );
    const events = service.audit.record.mock.calls.map(([event]) => event);
    expect(events).toEqual([
      expect.objectContaining({
        action: "create",
        entityType: "hotel_rate_card",
        entityId: NEW_CARD_ID,
        after: {
          hotelId: HOTEL_ID,
          name: NEW_CARD,
          source: "import",
          importJobId,
          changedFields: ["cardName", "validFrom", "validTo"],
        },
      }),
      expect.objectContaining({
        action: "create",
        entityType: "hotel_rate_item",
        entityId: NEW_ROW_ID,
        after: {
          hotelId: HOTEL_ID,
          rateCardId: NEW_CARD_ID,
          itemType: "per_plate_veg",
          source: "import",
          importJobId,
          changedFields: ["itemType", "amount", "unit"],
        },
      }),
      expect.objectContaining({ action: "update", entityId: ITEM_ID }),
      expect.objectContaining({ action: "create", entityId: NEW_ROW_ID }),
    ]);
    // An audit image names fields, never their values: no amount reaches it.
    expect(JSON.stringify(events)).not.toMatch(/1300000|180000|"minor"/);
  });

  it("locks the hotels, shares the named rooms, locks the cards and their items, then re-plans", async () => {
    const service = built();
    const { importJobId } = await service.service.preview("rates", csv(HEADER, CHANGED), HT);
    const { imports } = service;
    await service.service.apply("rates", importJobId, HT);
    expect(imports.lockHotelsBySlug).toHaveBeenCalledWith([LAKE], expect.anything());
    // Rooms are read, never written: shared, so a staff item edit's foreign-key check never waits.
    expect(imports.shareLiveRooms).toHaveBeenCalledWith([HOTEL_ID], expect.anything());
    expect(imports.lockLiveRooms).not.toHaveBeenCalled();
    expect(imports.shareLiveVenues).not.toHaveBeenCalled();
    expect(imports.lockLiveRateCards).toHaveBeenCalledWith([HOTEL_ID], expect.anything());
    expect(imports.lockLiveRateItems).toHaveBeenCalledWith([CARD_ID], expect.anything());
    // Every lock comes before the import's own reads of what it locked (the preview's reads came first).
    const last = (mock: { mock: { invocationCallOrder: number[] } }) =>
      mock.mock.invocationCallOrder.at(-1) ?? Number.NaN;
    const locks = [imports.shareLiveRooms, imports.lockLiveRateCards, imports.lockLiveRateItems];
    const reads = [imports.findLiveRooms, imports.findLiveRateCards];
    expect(last(imports.lockHotelsBySlug)).toBeLessThan(last(imports.findHotelRefsBySlugs));
    expect(Math.max(...locks.map(last))).toBeLessThan(Math.min(...reads.map(last)));
  });

  it("writes nothing for a row that changes nothing", async () => {
    const service = built();
    const { importJobId } = await service.service.preview("rates", csv(HEADER, KEPT), HT);
    const result = await service.service.apply("rates", importJobId, HT);
    expect(result).toMatchObject({ applied: false, unchanged: 1 });
    expect(service.ratesRepo.updateItem).not.toHaveBeenCalled();
    expect(service.audit.record).not.toHaveBeenCalled();
  });

  it("puts every row of a new card into the one card it creates", async () => {
    const service = built();
    const second = `${LAKE},synthetic SEASON 2028,,,Room rate,${ROOM_NAME},9000,,per night`;
    const { importJobId } = await service.service.preview("rates", csv(HEADER, FRESH, second), HT);
    await service.service.apply("rates", importJobId, HT);
    expect(service.ratesRepo.createCard).toHaveBeenCalledOnce();
    expect(service.ratesRepo.createItem.mock.calls.map(([cardId, data]) => [cardId, data])).toEqual(
      [
        [NEW_CARD_ID, expect.objectContaining({ itemType: "per_plate_veg" })],
        [NEW_CARD_ID, expect.objectContaining({ itemType: "room_rate", roomCategoryId: ROOM_ID })],
      ],
    );
  });
});
