import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { INDIAN_STATES } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { DRAFT, draftWith } from "../draft.test-fixtures";
import { decoded, tagsWith } from "../screen.test-utils";
import { BOOKING_TERMS_MODEL } from "./booking-terms.form";
import { BookingTermsSection } from "./booking-terms-section";
import { CONTACT_MODEL } from "./contact.form";
import { ContactSection } from "./contact-section";
import { editorAt } from "./editor.test-utils";
import { FACT_SHEET_MODEL } from "./fact-sheet.form";
import { FactSheetSection } from "./fact-sheet-section";
import { foodBeverageModel } from "./food-beverage.form";
import { FoodBeverageSection } from "./food-beverage-section";
import { PROPERTY_MODEL, propertyId } from "./property.form";
import { PropertySection } from "./property-section";
import { ROOMS_MODEL } from "./rooms.form";
import { RoomsSection } from "./rooms-section";
import { VENUES_MODEL } from "./venues.form";
import { VenuesSection } from "./venues-section";

/* The seven sections' questions (plan §5.1 and §5.3; D-190 §2), as the server would draw them. */

const ROW = "0192f3a0-7d3e-4b1a-9c2f-000000000001";
let next = 0;
const newKey = () => `0192f3a0-7d3e-4b1a-9c2f-${String((next += 1) + 500).padStart(12, "0")}`;
const html = (element: ReactElement) => decoded(renderToStaticMarkup(element));
const labels = (markup: string) =>
  [...markup.matchAll(/<(?:label|legend)[^>]*>([^<]+)/g)].map((match) => match[1]);

describe("property and location", () => {
  const fields = PROPERTY_MODEL.fieldsOf({ isChain: true, state: "Goa" }, newKey);
  const page = html(<PropertySection editor={editorAt(fields)} draft={DRAFT} />);

  it("asks the plan's questions, grouped under headings", () => {
    expect(labels(page)).toEqual(
      expect.arrayContaining([
        "Hotel name",
        "Is the hotel part of a chain or group?",
        "Name of the chain or group",
        "Street address",
        "Locality or area",
        "City or town",
        "State or union territory",
        "PIN code",
        "Google Maps link",
        "Official website",
        "Nearest airport",
        "Airport name",
        "Nearest railway station",
        "City centre",
        "Distance in km",
        "Drive in minutes",
        "Highways, landmarks and other directions",
        "Star category",
        "A short description",
        "Facilities",
      ]),
    );
    for (const heading of ["The hotel", "Address", "Getting there", "About the hotel"])
      expect(page).toMatch(new RegExp(`<h2 [^>]*>${heading}</h2>`));
  });

  it("offers India's states and union territories, and the facility chips with Other", () => {
    expect(tagsWith(page, "option", 'value="')).toHaveLength(INDIAN_STATES.length + 1 + 8 + 1);
    expect(tagsWith(page, "option", 'value="Goa"')[0]).toContain('selected=""');
    expect(tagsWith(page, "button", "aria-pressed")).toHaveLength(
      DRAFT.options.facilities.options.length + 1,
    );
  });

  it("marks the name, city and state as needed to submit a new hotel, and not on a refresh", () => {
    expect(tagsWith(page, "input", `id="${propertyId("name")}"`)[0]).toContain(
      'aria-required="true"',
    );
    expect(page).toContain("Needed before you submit");
    const refresh = html(
      <PropertySection editor={editorAt(fields)} draft={draftWith({ kind: "refresh" })} />,
    );
    expect(refresh).not.toContain("Needed before you submit");
  });

  it("answers Yes or No to a chain, and can be cleared", () => {
    expect(tagsWith(page, "input", 'value="yes"')[0]).toContain('checked=""');
    expect(page).toContain(">Clear<");
  });
});

describe("contacts", () => {
  const fields = CONTACT_MODEL.fieldsOf({}, newKey);
  const person = { fullName: "Asha Rao", designation: "General Manager" };

  it("asks each contact's name, role, phone and email, with Same as me", () => {
    const page = html(
      <ContactSection editor={editorAt(fields)} person={person} mobile="" max={3} />,
    );
    expect(labels(page)).toEqual(
      expect.arrayContaining(["Contacts", "Contact 1", "Name", "Role", "Phone", "Email"]),
    );
    expect(page).toContain(">Same as me<");
    expect(page).toContain(">Add another contact<");
  });

  it("offers no Same as me until the person's details are read", () => {
    const page = html(
      <ContactSection editor={editorAt(fields)} person={undefined} mobile="" max={3} />,
    );
    expect(page).not.toContain("Same as me");
  });
});

describe("rooms", () => {
  const fields = ROOMS_MODEL.fieldsOf(
    { rows: [{ rowId: ROW, name: "Deluxe", size: { value: 60, unit: "sqm" } }] },
    newKey,
  );
  const page = html(<RoomsSection editor={editorAt(fields)} caps={DRAFT.caps} />);

  it("asks the total and each category's name, count, type, size with its unit, occupancy, view, beds", () => {
    expect(labels(page)).toEqual(
      expect.arrayContaining([
        "Total rooms in the hotel",
        "Room categories",
        "Deluxe",
        "Category name",
        "Number of rooms",
        "Type",
        "Size",
        "Most guests in one room",
        "View",
        "Beds",
        "Notes",
      ]),
    );
    expect(tagsWith(page, "select", 'aria-label="Unit of size"')).toHaveLength(1);
    expect(tagsWith(page, "option", 'value="sqm"')[0]).toContain('selected=""');
    expect(page).toContain(">Add a room category<");
  });
});

describe("venues", () => {
  const fields = VENUES_MODEL.fieldsOf(
    {
      rows: [{ rowId: ROW, name: "Lake Lawn", otherLayouts: [{ layout: "Classroom", max: 120 }] }],
    },
    newKey,
  );
  const page = html(<VenuesSection editor={editorAt(fields)} caps={DRAFT.caps} />);

  it("asks each venue's setting, type, area, capacities as numbers or ranges, layouts, dimensions and more", () => {
    expect(labels(page)).toEqual(
      expect.arrayContaining([
        "Total event space",
        "Venues",
        "Lake Lawn",
        "Venue name",
        "Setting",
        "Type of venue",
        "Area",
        "Seated (dinner at round tables)",
        "Floating (standing reception or cocktails)",
        "Theatre style",
        "Other layouts",
        "Classroom",
        "Length in metres",
        "Width in metres",
        "Ceiling height in metres",
        "Pre-function area",
      ]),
    );
    expect(page).toContain(">Covered or semi-open<");
    expect(page).toContain("A number of guests, or a range such as 250–300");
    expect(page).toContain(">Add a layout<");
  });
});

describe("booking terms, food and beverage, the fact sheet", () => {
  it("asks about a full buyout with Yes, No or Depends, and the fewest rooms unless always required", () => {
    const fields = { ...BOOKING_TERMS_MODEL.fieldsOf({}, newKey), buyout: "depends" };
    const page = html(<BookingTermsSection editor={editorAt(fields)} />);
    expect(labels(page)).toEqual(
      expect.arrayContaining([
        "Do weddings need a full buyout of the hotel?",
        "Fewest rooms a wedding books without a full buyout",
        "Fewest nights a wedding books",
        "Can several functions run at once, or on the same day?",
      ]),
    );
    expect(page.match(/>Depends</g)).toHaveLength(2);
    const required = html(
      <BookingTermsSection editor={editorAt({ ...fields, buyout: "required" })} />,
    );
    expect(required).not.toContain("Fewest rooms a wedding books without a full buyout");
  });

  it("offers the cuisine chips from the draft's options, and three Yes or No facts", () => {
    const model = foodBeverageModel("Other");
    const page = html(
      <FoodBeverageSection editor={editorAt(model.fieldsOf({}, newKey))} draft={DRAFT} />,
    );
    expect(tagsWith(page, "button", "aria-pressed")).toHaveLength(
      DRAFT.options.cuisines.options.length + 1,
    );
    expect(labels(page)).toEqual(
      expect.arrayContaining([
        "Is the hotel pure vegetarian?",
        "Is there a separate vegetarian kitchen?",
        "Is alcohol served?",
      ]),
    );
  });

  it("asks when the fact sheet was last updated, as a month, with no upload control yet", () => {
    const page = html(
      <FactSheetSection editor={editorAt(FACT_SHEET_MODEL.fieldsOf({}, newKey))} />,
    );
    expect(tagsWith(page, "input", 'type="month"')).toHaveLength(1);
    expect(page).not.toContain('type="file"');
  });
});
