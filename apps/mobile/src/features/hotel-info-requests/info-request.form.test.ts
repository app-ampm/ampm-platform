import {
  EMPTY_NEW_HOTEL_DRAFT,
  EMPTY_REQUEST_DRAFT,
  editBody,
  editDraftFrom,
  editErrors,
  existingHotelBody,
  extendPreview,
  newHotelBody,
  REQUEST_FIELDS,
  requestErrors,
  revokeReasonError,
} from "./info-request.form";
import { HOTEL_ID, requestFullFixture } from "./info-requests.test-utils";

const DESTINATION_ID = "018f0000-0000-7000-8000-0000000c0002";

describe("REQUEST_FIELDS", () => {
  it("names every field of the drafts that can carry an error, and not the switches", () => {
    const switches = ["kind", "emailIt", "isTest"];
    const drafted = Object.keys(EMPTY_NEW_HOTEL_DRAFT).filter((key) => !switches.includes(key));
    expect([...REQUEST_FIELDS].sort()).toEqual(drafted.sort());
  });
});

describe("the Send request body", () => {
  it("sends only what was filled in, trimmed, with the kind and the switches", () => {
    const body = existingHotelBody(HOTEL_ID, {
      ...EMPTY_REQUEST_DRAFT,
      recipientName: "  Priya Sharma ",
      recipientEmail: "Priya@Lakeside.example",
      kind: "refresh",
      emailIt: true,
    });
    expect(body).toEqual({
      target: "existing",
      hotelId: HOTEL_ID,
      kind: "refresh",
      recipientName: "Priya Sharma",
      recipientEmail: "Priya@Lakeside.example",
      emailIt: true,
      isTest: false,
    });
    expect(requestErrors(body)).toEqual({});
  });

  it("asks for the recipient's email before emailing the link, in the contract's words", () => {
    const body = existingHotelBody(HOTEL_ID, { ...EMPTY_REQUEST_DRAFT, emailIt: true });
    expect(requestErrors(body)).toEqual({
      recipientEmail: "Enter the recipient's email to email the link",
    });
  });

  it("checks the switchboard number, the website and the email in the contract's words", () => {
    const body = existingHotelBody(HOTEL_ID, {
      ...EMPTY_REQUEST_DRAFT,
      switchboardPhone: "12",
      switchboardSource: "Hotel website",
      officialWebsite: "not a site",
      recipientEmail: "nobody",
    });
    expect(requestErrors(body)).toEqual({
      switchboardPhone: "Enter the switchboard's full number, such as +91 141 234 5678",
      officialWebsite: "Enter a web address such as https://www.hotel.example",
      recipientEmail: "Enter an email such as sales@hotel.example",
    });
  });

  it("keeps a switchboard number and its source together", () => {
    const number = { ...EMPTY_REQUEST_DRAFT, switchboardPhone: "+91 141 234 5678" };
    expect(requestErrors(existingHotelBody(HOTEL_ID, number))).toEqual({
      switchboardSource: "Say where the switchboard number came from",
    });
    const source = { ...EMPTY_REQUEST_DRAFT, switchboardSource: "Hotel website" };
    expect(requestErrors(existingHotelBody(HOTEL_ID, source))).toEqual({
      switchboardPhone: "Enter the switchboard number this source is for",
    });
  });

  it("says when a text is too long for its field", () => {
    const body = existingHotelBody(HOTEL_ID, {
      ...EMPTY_REQUEST_DRAFT,
      displayLabel: "x".repeat(256),
    });
    expect(requestErrors(body)).toEqual({
      displayLabel: "Keep the label to 255 characters at most",
    });
  });
});

describe("the Invite a new hotel body", () => {
  it("asks for the name and the destination, and leaves a blank website out (D-192)", () => {
    const body = newHotelBody({ ...EMPTY_NEW_HOTEL_DRAFT, proposedWebAddress: "  " });
    expect(body).not.toHaveProperty("proposedWebAddress");
    expect(requestErrors(body)).toEqual({
      proposedName: "Enter the hotel's name",
      proposedDestinationId: "Choose the hotel's destination",
    });
  });

  it("checks a website given in the contract's words", () => {
    const body = newHotelBody({ ...EMPTY_NEW_HOTEL_DRAFT, proposedWebAddress: "not a website" });
    expect(requestErrors(body)).toMatchObject({
      proposedWebAddress: "Enter a web address such as https://www.hotel.example",
    });
  });

  it("sends the proposed hotel, always as its onboarding, and a Super Admin's test flag", () => {
    const body = newHotelBody({
      ...EMPTY_NEW_HOTEL_DRAFT,
      proposedName: " The Desert Fort ",
      proposedDestinationId: DESTINATION_ID,
      proposedWebAddress: "desert-fort.example",
      kind: "refresh",
      isTest: true,
    });
    expect(body).toEqual({
      target: "new",
      proposedName: "The Desert Fort",
      proposedDestinationId: DESTINATION_ID,
      proposedWebAddress: "desert-fort.example",
      emailIt: false,
      isTest: true,
    });
    expect(requestErrors(body)).toEqual({});
  });
});

describe("the edit", () => {
  it("starts from the request, and sends only what changed, a blank as a clear", () => {
    const request = requestFullFixture({ displayLabel: "Lake refresh" });
    const draft = editDraftFrom(request);
    expect(draft).toEqual({
      displayLabel: "Lake refresh",
      staffNote: "",
      recipientName: "Synthetic Sales Desk",
      recipientEmail: "sales@lakeside.example",
    });
    expect(editBody(request, { ...draft, displayLabel: "", staffNote: " Call first " })).toEqual({
      displayLabel: null,
      staffNote: "Call first",
    });
    expect(editBody(request, draft)).toEqual({});
  });

  it("checks the recipient's email, and says when nothing changed", () => {
    const request = requestFullFixture();
    expect(
      editErrors(editBody(request, { ...editDraftFrom(request), recipientEmail: "x" })),
    ).toEqual({
      recipientEmail: "Enter an email such as sales@hotel.example",
    });
    expect(editErrors({})).toEqual({ form: "Nothing has changed" });
  });
});

describe("extendPreview", () => {
  const now = new Date("2026-11-25T10:00:00.000Z");
  const request = requestFullFixture({
    expiresAt: "2026-12-24T10:00:00.000Z",
    extendableUntil: "2027-02-22T10:00:00.000Z",
  });

  it("adds the days to the later of now and the current expiry", () => {
    expect(extendPreview(request, "14", now)).toEqual({
      days: 14,
      expiresAt: "2027-01-07T10:00:00.000Z",
    });
    const expired = { ...request, expiresAt: "2026-11-01T10:00:00.000Z", isExpired: true };
    expect(extendPreview(expired, "7", now).expiresAt).toBe("2026-12-02T10:00:00.000Z");
  });

  it("refuses anything but 1 to 60 whole days, and a date past the limit", () => {
    expect(extendPreview(request, "", now).error).toBe("Enter a number of days from 1 to 60");
    expect(extendPreview(request, "1.5", now).error).toBe("Enter a number of days from 1 to 60");
    expect(extendPreview(request, "61", now).error).toBe("Enter a number of days from 1 to 60");
    expect(extendPreview(request, "60", now).expiresAt).toBe("2027-02-22T10:00:00.000Z");
    const capped = { ...request, extendableUntil: "2027-01-31T10:00:00.000Z" };
    expect(extendPreview(capped, "40", now).error).toBe(
      "This link can be extended to 31 Jan 2027 at the latest",
    );
    expect(extendPreview({ ...request, extendableUntil: null }, "1", now).error).toBe(
      "This request can no longer be extended",
    );
  });
});

describe("revokeReasonError", () => {
  it("asks for a reason", () => {
    expect(revokeReasonError("  ")).toBe("Say why the request is revoked");
    expect(revokeReasonError("Sent to the wrong hotel")).toBeUndefined();
  });
});
