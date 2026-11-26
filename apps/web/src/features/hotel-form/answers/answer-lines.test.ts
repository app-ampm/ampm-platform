import { describe, expect, it } from "vitest";

import { answerLinesOf } from "./answer-lines";

/* A section's saved answers in words (HF-06's summary, HF-07's read-only answers; D-190 §5). */

const ROW_A = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const ROW_B = "0192f3a0-7d3e-7b1a-9c2f-0000000000b2";

describe("a section's answers in words", () => {
  it("lists only what was answered, in the form's order and words, with nothing for an empty section", () => {
    expect(answerLinesOf("booking_terms", {})).toEqual({ lines: [], groups: [] });
    const terms = answerLinesOf("booking_terms", {
      weddingBuyoutPolicy: "not_required",
      minRoomsWithoutBuyout: 40,
      parallelFunctions: "depends",
      notes: null,
    });
    expect(terms.lines).toEqual([
      { label: "Do weddings need a full buyout of the hotel?", value: "No" },
      { label: "Fewest rooms a wedding books without a full buyout", value: "40" },
      { label: "Can several functions run at once, or on the same day?", value: "Depends" },
    ]);
  });

  it("writes the property's choices, distances and chips as a person reads them", () => {
    const { lines } = answerLinesOf("property", {
      name: "Synthetic Lake Palace",
      isChain: true,
      groupName: "Synthetic Group",
      city: "Udaipur",
      state: "Rajasthan",
      airport: { name: "Synthetic Airport", km: 22.5, minutes: 35 },
      cityCentre: { km: 3 },
      facilities: ["Spa", "Other"],
      facilitiesOther: "Boat jetty",
      noLongerOffered: "The old lawn closed.",
    });
    expect(lines).toEqual([
      { label: "Hotel name", value: "Synthetic Lake Palace" },
      { label: "Is the hotel part of a chain or group?", value: "Yes" },
      { label: "Name of the chain or group", value: "Synthetic Group" },
      { label: "City or town", value: "Udaipur" },
      { label: "State or union territory", value: "Rajasthan" },
      { label: "Nearest airport", value: "Synthetic Airport · 22.5 km · 35 min" },
      { label: "City centre", value: "3 km" },
      { label: "Facilities", value: "Spa" },
      { label: "Other facilities", value: "Boat jetty" },
      { label: "Anything no longer offered or renamed?", value: "The old lawn closed." },
    ]);
  });

  it("keeps Other among the chips when its words were not given", () => {
    const { lines } = answerLinesOf("food_beverage", {
      cuisines: ["Indian", "Other"],
      isPureVegetarian: false,
      servesAlcohol: true,
    });
    expect(lines).toEqual([
      { label: "Cuisines your kitchens cook", value: "Indian, Other" },
      { label: "Is the hotel pure vegetarian?", value: "No" },
      { label: "Is alcohol served?", value: "Yes" },
    ]);
  });

  it("gives each contact its own group, leaving out a blank one", () => {
    const { groups } = answerLinesOf("contact", {
      contacts: [
        { name: "Synthetic Contact", role: "Events", email: "events@hotel.example" },
        { name: null, role: null, phone: null, email: null },
        { phone: "+919800000001" },
      ],
    });
    expect(groups).toEqual([
      {
        key: "contact-0",
        heading: "Contact 1",
        lines: [
          { label: "Name", value: "Synthetic Contact" },
          { label: "Role", value: "Events" },
          { label: "Email", value: "events@hotel.example" },
        ],
      },
      {
        key: "contact-2",
        heading: "Contact 3",
        lines: [{ label: "Phone", value: "+919800000001" }],
      },
    ]);
  });

  it("heads each room and venue with its name, or its place while unnamed, with units and ranges", () => {
    const rooms = answerLinesOf("rooms", {
      totalRooms: 40,
      rows: [
        {
          rowId: ROW_A,
          name: "Lake View Suite",
          roomCount: 6,
          unitType: "suite",
          size: { value: 650, unit: "sqft" },
        },
        { rowId: ROW_B, roomCount: 10, size: { unit: "sqm" } },
      ],
    });
    expect(rooms.lines).toEqual([{ label: "Total rooms in the hotel", value: "40" }]);
    expect(rooms.groups).toEqual([
      {
        key: ROW_A,
        heading: "Lake View Suite",
        lines: [
          { label: "Number of rooms", value: "6" },
          { label: "Type", value: "Suite" },
          { label: "Size", value: "650 sq ft" },
        ],
      },
      // A size whose number is not given yet is no answer here; the missing items name it.
      {
        key: ROW_B,
        heading: "Room category 2",
        lines: [{ label: "Number of rooms", value: "10" }],
      },
    ]);
    const venues = answerLinesOf("venues", {
      totalEventSpace: { value: 12000, unit: "sqft" },
      rows: [
        {
          rowId: ROW_A,
          name: "Synthetic Lawn",
          setting: "outdoor",
          venueType: "lawn",
          area: { value: 900, unit: "sqm" },
          seated: { min: 250, max: 300 },
          floating: 500,
          otherLayouts: [
            { layout: "Classroom", min: 30, max: 40 },
            { layout: "Boardroom", max: 20 },
          ],
          ceilingHeightM: 4.5,
        },
      ],
    });
    expect(venues.lines).toEqual([{ label: "Total event space", value: "12000 sq ft" }]);
    expect(venues.groups[0]?.lines).toEqual([
      { label: "Setting", value: "Outdoor" },
      { label: "Type of venue", value: "Lawn" },
      { label: "Area", value: "900 m²" },
      { label: "Seated (dinner at round tables)", value: "250–300" },
      { label: "Floating (standing reception or cocktails)", value: "500" },
      { label: "Other layouts", value: "Classroom: 30–40; Boardroom: 20" },
      { label: "Ceiling height in metres", value: "4.5" },
    ]);
  });

  it("asks only the fact sheet's month until its uploads arrive", () => {
    expect(answerLinesOf("fact_sheet_media", { factSheetAsOf: "2026-09" }).lines).toEqual([
      { label: "When was your fact sheet last updated?", value: "2026-09" },
    ]);
  });
});
