import { describe, expect, it } from "vitest";

import { matchContact, matchRowsByName } from "./hotel-row-match";

const SUITE = { id: "room-1", name: "Lake View Suite" };
const GARDEN = { id: "room-2", name: "Garden Room" };
const TWIN_A = { id: "room-3", name: "Deluxe  Room" };
const TWIN_B = { id: "room-4", name: "deluxe room" };

describe("matchRowsByName", () => {
  it("matches a live row exactly once normalised, and creates for an unknown name", () => {
    expect(matchRowsByName([SUITE, GARDEN], [" lake view  SUITE", "Pool Villa"])).toEqual([
      { match: "existing", row: SUITE },
      { match: "new" },
    ]);
  });

  it("never matches a similar name: only exact normalised matches count", () => {
    expect(matchRowsByName([SUITE], ["Lake-View Suite", "Lake View Suites"])).toEqual([
      { match: "new" },
      { match: "new" },
    ]);
  });

  it("reports two live rows sharing a name as ambiguous", () => {
    expect(matchRowsByName([SUITE, TWIN_A, TWIN_B], ["Deluxe Room"])).toEqual([
      { match: "ambiguous", rows: [TWIN_A, TWIN_B] },
    ]);
  });

  it("reports the second line naming the same row as repeated, whatever it matches", () => {
    expect(
      matchRowsByName([SUITE], ["Lake View Suite", "Pool Villa", "lake view suite", "POOL VILLA"]),
    ).toEqual([
      { match: "existing", row: SUITE },
      { match: "new" },
      { match: "repeated", firstIndex: 0 },
      { match: "repeated", firstIndex: 1 },
    ]);
  });

  it("matches nothing against a hotel with no live rows", () => {
    expect(matchRowsByName([], ["Lake View Suite"])).toEqual([{ match: "new" }]);
  });
});

const FRONT_DESK = {
  id: "contact-1",
  name: "Front Desk",
  email: null,
  phone: "+911412345678",
};
const SALES = {
  id: "contact-2",
  name: "Synthetic Sales Lead",
  email: "sales@synthetic-hotel.example",
  phone: "Ext. 4120 via the operator",
};
const EVENTS = {
  id: "contact-3",
  name: "Synthetic Events Lead",
  email: "events@synthetic-hotel.example",
  phone: "+919876543210",
};

describe("matchContact", () => {
  const contacts = [FRONT_DESK, SALES, EVENTS];

  it("matches by email first, whatever the phone says", () => {
    expect(
      matchContact(contacts, { email: " Sales@Synthetic-Hotel.example ", phone: "98765 43210" }),
    ).toEqual({ match: "existing", by: "email", contact: SALES });
  });

  it("falls back to the E.164 phone when the email matches nobody", () => {
    expect(
      matchContact(contacts, { email: "new@synthetic-hotel.example", phone: "0141 234 5678" }),
    ).toEqual({ match: "existing", by: "phone", contact: FRONT_DESK });
  });

  it("never matches on a stored phone that does not read as one", () => {
    expect(matchContact(contacts, { phone: "Ext. 4120 via the operator" })).toEqual({
      match: "none",
    });
  });

  it("falls back to the name last", () => {
    expect(matchContact(contacts, { name: "  synthetic events LEAD " })).toEqual({
      match: "existing",
      by: "name",
      contact: EVENTS,
    });
  });

  it("reports contacts sharing the deciding key as ambiguous", () => {
    const twin = { ...EVENTS, id: "contact-4", name: "Synthetic Events Desk" };
    expect(matchContact([EVENTS, twin], { email: "events@synthetic-hotel.example" })).toEqual({
      match: "ambiguous",
      by: "email",
      contacts: [EVENTS, twin],
    });
  });

  it("matches none when no key is given or shared", () => {
    expect(matchContact(contacts, {})).toEqual({ match: "none" });
    expect(matchContact(contacts, { name: "Synthetic Spa Manager", email: "  " })).toEqual({
      match: "none",
    });
  });
});
