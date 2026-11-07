import { dateErrors, EMPTY_REQUEST_DRAFT, isIsoDate, toCreateRequest } from "./new-request.form";

const HOTEL_ID = "018f0000-0000-7000-8000-00000000beef";

describe("isIsoDate", () => {
  it("accepts real YYYY-MM-DD dates only, as the server's z.iso.date() does", () => {
    expect(isIsoDate("2027-02-14")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("14-02-2027")).toBe(false);
    expect(isIsoDate("2027-2-14")).toBe(false);
  });
});

describe("dateErrors", () => {
  it("stays quiet until both dates are entered", () => {
    expect(dateErrors("2027-02-30", "")).toEqual({});
    expect(dateErrors("", "nonsense")).toEqual({});
  });

  it("names the field whose date is not real", () => {
    expect(dateErrors("2027-02-30", "2027-03-02")).toEqual({
      dateFrom: "Enter check-in as a real date, YYYY-MM-DD.",
    });
    expect(dateErrors("2027-02-14", "16/02/2027")).toEqual({
      dateFrom: undefined,
      dateTo: "Enter check-out as a real date, YYYY-MM-DD.",
    });
  });

  it("puts check-out before check-in on check-out", () => {
    expect(dateErrors("2027-02-16", "2027-02-14")).toEqual({
      dateTo: "Check-out must be on or after check-in.",
    });
    expect(dateErrors(" 2027-02-14 ", "2027-02-14")).toEqual({});
  });
});

describe("toCreateRequest", () => {
  const filled = {
    ...EMPTY_REQUEST_DRAFT,
    dateFrom: " 2027-02-14 ",
    dateTo: "2027-02-16",
    guests: "120",
  };

  it("builds the CP-07 request from a complete form, trimming what was typed", () => {
    expect(
      toCreateRequest(HOTEL_ID, { ...filled, functions: "  Sangeet  ", datesFlexible: true }),
    ).toEqual({
      hotelId: HOTEL_ID,
      dateFrom: "2027-02-14",
      dateTo: "2027-02-16",
      datesFlexible: true,
      guestEstimate: 120,
      roomsRequired: null,
      functionsSummary: "Sangeet",
      contactPreference: null,
      notesClient: null,
    });
    expect(toCreateRequest(HOTEL_ID, filled)?.functionsSummary).toBeNull();
    expect(toCreateRequest(HOTEL_ID, filled)?.datesFlexible).toBe(false);
  });

  it("holds the request back until the dates are valid and in order and someone is coming", () => {
    expect(toCreateRequest(HOTEL_ID, EMPTY_REQUEST_DRAFT)).toBeNull();
    expect(toCreateRequest(HOTEL_ID, { ...filled, guests: "0" })).toBeNull();
    expect(toCreateRequest(HOTEL_ID, { ...filled, guests: "many" })).toBeNull();
    expect(toCreateRequest(HOTEL_ID, { ...filled, dateTo: "2027-02-13" })).toBeNull();
    expect(toCreateRequest(HOTEL_ID, { ...filled, dateFrom: "2027-02-30" })).toBeNull();
  });
});
