import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import type { Principal } from "../../policy/principal.types.js";
import { CHANGED_SINCE_PREVIEW } from "./hotel-import.job.js";
import {
  buildImportService,
  csv,
  type ImportCatalogue,
} from "./testing/import-service-fixtures.js";
import { rateCardRow, rateItemRow } from "./testing/rate-import-fixtures.js";
import {
  CARD_NAME,
  OTHER_CARD_ID,
  OTHER_ITEM_ID,
  ROOM_NAME,
} from "./testing/rate-plan-fixtures.js";
import { decimal, roomRow } from "./testing/subresource-fixtures.js";

/*
 * What an import says of a Rates row whose target moved after its preview (D-184, §4): "Changed since
 * preview" when the item it planned against moved, went or is no longer the one its cells name; when the
 * card it planned to add an item to moved (verified, made stale, retired or redated), went, was renamed,
 * or gained the very item meanwhile; and when the card it planned to create now exists. A re-plan refused
 * on the very target it planned against keeps its own reason. Synthetic data only.
 */

const HT = staffPrincipal(["HT"]);
const HEADER = "hotelSlug,cardName,validFrom,itemType,roomName,amount,unit";
const LAKE = "synthetic-lake-hotel";
/** Changes the stored room rate: its target is that item. */
const UPDATE = `${LAKE},${CARD_NAME},,Room rate,${ROOM_NAME},13000,`;
/** Adds a tax to the stored card: its target is the card. */
const ADD = `${LAKE},${CARD_NAME},,Tax,,18,percent`;
/** Adds a wedding package for the suite to the stored card. */
const ADD_FOR_ROOM = `${LAKE},${CARD_NAME},,Wedding package,${ROOM_NAME},500000,per event`;
/** Creates a card: no target. */
const FRESH = `${LAKE},Synthetic season 2028,2028-04-01,Tax,,18,percent`;
const CHANGED = [{ field: "row", message: CHANGED_SINCE_PREVIEW }];

/** Previews rows as the Hotel team, edits the catalogue as a staff member would, then imports. */
async function importAfter(
  rows: readonly string[],
  edit: (state: ImportCatalogue) => void,
  principal: Principal = HT,
) {
  const built = buildImportService({ rooms: [roomRow()], rateCards: [rateCardRow()] });
  const { importJobId } = await built.service.preview("rates", csv(HEADER, ...rows), HT);
  edit(built.state);
  const result = await built.service.apply("rates", importJobId, principal);
  return {
    built,
    result,
    errorsOf: (line: number) => result.rejected.find((r) => r.line === line)?.errors,
  };
}

describe("a rates row whose item moved since its preview", () => {
  it("is refused when the item holds other values, or went", async () => {
    const moved = await importAfter([UPDATE], (state) => {
      state.rateCards = [rateCardRow({ items: [rateItemRow({ amount: decimal("12600.00") })] })];
    });
    expect(moved.errorsOf(2)).toEqual(CHANGED);
    expect(moved.built.ratesRepo.updateItem).not.toHaveBeenCalled();
    const gone = await importAfter([UPDATE], (state) => {
      state.rateCards = [rateCardRow({ items: [] })];
    });
    expect(gone.errorsOf(2)).toEqual(CHANGED);
  });

  it("is refused when another item now holds its key, though the item itself holds", async () => {
    const elsewhere = "0192f1a0-0000-7000-8000-0000000000f9";
    const { errorsOf } = await importAfter([UPDATE], (state) => {
      const items = [
        rateItemRow({ roomCategoryId: elsewhere }),
        rateItemRow({ id: OTHER_ITEM_ID }),
      ];
      state.rateCards = [rateCardRow({ items })];
    });
    expect(errorsOf(2)).toEqual(CHANGED);
  });

  it("keeps its own reason when refused on its own item or card: a lost key, a verified card", async () => {
    const reader = staffPrincipal(
      [],
      [
        "hotels.rate_cards_rate_items.create:all",
        "hotels.rate_cards_rate_items.read:all",
        "hotels.room_categories_venues.read:all",
      ],
    );
    const lost = await importAfter([UPDATE], () => {}, reader);
    expect(lost.errorsOf(2)).toEqual([
      {
        field: "itemType",
        message: "This card already has this item, and you cannot change rate items",
      },
    ]);
    const verified = await importAfter([UPDATE], (state) => {
      state.rateCards = [rateCardRow({ status: "verified" })];
    });
    expect(verified.errorsOf(2)).toEqual([
      expect.objectContaining({ message: expect.stringMatching(/^Rates are imported only/) }),
    ]);
  });
});

describe("a rates row adding an item to a stored card that moved since its preview", () => {
  it("is refused when the card was verified, made stale, retired or redated", async () => {
    for (const card of [
      rateCardRow({ status: "verified" }),
      rateCardRow({ status: "stale" }),
      rateCardRow({ status: "retired" }),
      rateCardRow({ validTo: new Date("2028-01-31T00:00:00.000Z") }),
    ]) {
      const { errorsOf, built } = await importAfter([ADD], (state) => {
        state.rateCards = [card];
      });
      expect(errorsOf(2)).toEqual(CHANGED);
      expect(built.ratesRepo.createItem).not.toHaveBeenCalled();
    }
  });

  it("is refused when the card went, was renamed, or another card now has its name", async () => {
    for (const cards of [
      [],
      [rateCardRow({ name: "Synthetic renamed season" })],
      [rateCardRow({ name: "Synthetic renamed season" }), rateCardRow({ id: OTHER_CARD_ID })],
    ]) {
      const { errorsOf } = await importAfter([ADD], (state) => {
        state.rateCards = cards;
      });
      expect(errorsOf(2)).toEqual(CHANGED);
    }
  });

  it("is refused when the item it would add was added meanwhile", async () => {
    const { errorsOf } = await importAfter([ADD], (state) => {
      const tax = rateItemRow({ id: OTHER_ITEM_ID, itemType: "tax", roomCategoryId: null });
      state.rateCards = [rateCardRow({ items: [rateItemRow(), tax] })];
    });
    expect(errorsOf(2)).toEqual(CHANGED);
  });

  it("keeps its own reason when its room was renamed, while the card holds", async () => {
    const { errorsOf } = await importAfter([ADD_FOR_ROOM], (state) => {
      state.rooms = [roomRow({ name: "Synthetic Garden Suite" })];
    });
    expect(errorsOf(2)).toEqual([{ field: "roomName", message: `No room named ${ROOM_NAME}` }]);
  });
});

describe("a rates row creating a card", () => {
  it("is refused when a card of its name was made meanwhile", async () => {
    const { errorsOf, built } = await importAfter([FRESH], (state) => {
      state.rateCards = [
        rateCardRow(),
        rateCardRow({ id: OTHER_CARD_ID, name: "Synthetic season 2028", items: [] }),
      ];
    });
    expect(errorsOf(2)).toEqual(CHANGED);
    expect(built.ratesRepo.createCard).not.toHaveBeenCalled();
  });

  it("creates the card when nothing took its name", async () => {
    const { result } = await importAfter([FRESH], () => {});
    expect(result).toMatchObject({ created: 1, rejected: [] });
  });

  // The preview made the card from its first row, with that row's dates. When that row is refused at
  // import (its room renamed meanwhile), the card must not be made from another row, under other dates.
  it("refuses a new card's other rows as changed when the row that made it is refused", async () => {
    const card = "Synthetic season 2030";
    const { errorsOf, built } = await importAfter(
      [
        `${LAKE},${card},2030-04-01,Room rate,${ROOM_NAME},28000,per night`,
        `${LAKE},${card},,Tax,,18,percent`,
        `${LAKE},${card},2030-04-01,Other,,5000,per event`,
      ],
      (state) => {
        state.rooms = [roomRow({ name: "Synthetic Renamed Suite" })];
      },
    );
    expect(errorsOf(2)).toEqual([{ field: "roomName", message: `No room named ${ROOM_NAME}` }]);
    expect(errorsOf(3)).toEqual(CHANGED);
    expect(errorsOf(4)).toEqual(CHANGED);
    expect(built.ratesRepo.createCard).not.toHaveBeenCalled();
    expect(built.ratesRepo.createItem).not.toHaveBeenCalled();
  });
});
