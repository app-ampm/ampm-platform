import {
  buildDestinationCreateBody,
  buildDestinationUpdateBody,
  draftFromDestination,
  validateDestination,
  type DestinationDraft,
} from "./destinations.form";
import { destinationViewFixture } from "./hotels-admin.test-utils";

const draft = (overrides: Partial<DestinationDraft> = {}): DestinationDraft => ({
  ...draftFromDestination(null),
  name: "Udaipur",
  ...overrides,
});

describe("draftFromDestination", () => {
  it("starts a new destination as an unpublished draft in India", () => {
    expect(draftFromDestination(null)).toEqual({
      name: "",
      slug: "",
      region: "",
      state: "",
      country: "India",
      description: "",
      status: "draft",
      publicVisible: false,
    });
  });

  it("seeds an edit from the destination, blanks for its empty fields", () => {
    expect(draftFromDestination(destinationViewFixture())).toEqual({
      name: "Udaipur",
      slug: "udaipur",
      region: "",
      state: "Rajasthan",
      country: "India",
      description: "",
      status: "active",
      publicVisible: true,
    });
  });
});

describe("validateDestination", () => {
  it("passes a named destination with a blank slug, which the server makes", () => {
    expect(Object.values(validateDestination(draft(), true)).every((e) => e === undefined)).toBe(
      true,
    );
  });

  it("asks for the name and the country", () => {
    const errors = validateDestination(draft({ name: "  ", country: "" }), true);
    expect(errors.name).toBe("Enter the destination's name");
    expect(errors.country).toBe("Enter the country");
  });

  it("refuses a typed slug that breaks the contract's rule, on create only", () => {
    expect(validateDestination(draft({ slug: "North Goa" }), true).slug).toBe(
      "Use lowercase letters, numbers and single hyphens, e.g. north-goa",
    );
    expect(validateDestination(draft({ slug: "north--goa" }), true).slug).toBeDefined();
    expect(validateDestination(draft({ slug: "north-goa" }), true).slug).toBeUndefined();
    // An edit never sends the slug, so it is never checked there.
    expect(validateDestination(draft({ slug: "North Goa" }), false).slug).toBeUndefined();
  });

  it("holds each text to the field matrix's length", () => {
    const errors = validateDestination(
      draft({ region: "r".repeat(256), description: "d".repeat(10_001) }),
      true,
    );
    expect(errors.region).toBe("Keep the region under 255 characters");
    expect(errors.description).toBe("Keep the description under 10,000 characters");
  });
});

describe("request bodies", () => {
  it("creates with trimmed text, blanks as null and no slug when none was typed", () => {
    expect(
      buildDestinationCreateBody(draft({ name: " Udaipur ", state: " Rajasthan ", region: " " })),
    ).toEqual({
      name: "Udaipur",
      region: null,
      state: "Rajasthan",
      country: "India",
      description: null,
      status: "draft",
      publicVisible: false,
    });
  });

  it("creates with a typed slug", () => {
    expect(buildDestinationCreateBody(draft({ slug: " north-goa " }))).toMatchObject({
      slug: "north-goa",
    });
  });

  it("edits every field but the slug, which never changes", () => {
    const body = buildDestinationUpdateBody(
      draft({ slug: "udaipur", status: "active", publicVisible: true, description: "Lakes" }),
    );
    expect(body).not.toHaveProperty("slug");
    expect(body).toEqual({
      name: "Udaipur",
      region: null,
      state: null,
      country: "India",
      description: "Lakes",
      status: "active",
      publicVisible: true,
    });
  });
});
