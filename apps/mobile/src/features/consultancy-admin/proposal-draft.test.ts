import {
  CLIENT_LINE,
  INTERNAL_LINE,
  proposalFixture,
  proposalWithoutGrant,
} from "./commercial.fixtures";
import {
  clientLinesTotalMinor,
  draftFromProposal,
  EMPTY_TOTALS,
  emptyLine,
  lineToInput,
  proposalRequest,
  proposalUpdateRequest,
  quantityError,
  type LineDraft,
} from "./proposal-draft";

const ENQUIRY_ID = "018f0000-0000-7000-8000-0000000000e1";

/** A complete client-visible line: 60 rooms at ₹12,000, ₹7,20,000. */
function line(overrides: Partial<LineDraft> = {}): LineDraft {
  return {
    ...emptyLine(0),
    itemType: "room_rate",
    description: "Deluxe rooms",
    quantity: "60",
    unitAmount: "12000",
    totalAmount: "7,20,000",
    clientVisible: true,
    ...overrides,
  };
}

const TOTALS = { ...EMPTY_TOTALS, clientTotal: "1850000", internalTotal: "17,00,000" };

describe("lineToInput", () => {
  it("parses a complete line to the wire shape, amounts in paise", () => {
    expect(lineToInput(line())).toEqual({
      itemType: "room_rate",
      description: "Deluxe rooms",
      quantity: 60,
      unitAmount: { minor: 1_200_000, currency: "INR" },
      totalAmount: { minor: 72_000_000, currency: "INR" },
      clientVisible: true,
    });
  });

  it("fails closed until the visibility is chosen on purpose", () => {
    expect(lineToInput(line({ clientVisible: null }))).toBeNull();
    expect(lineToInput(line({ clientVisible: false }))?.clientVisible).toBe(false);
  });

  it("rejects a missing kind, a blank description, a zero quantity or an unreadable amount", () => {
    expect(lineToInput(line({ itemType: null }))).toBeNull();
    expect(lineToInput(line({ description: "  " }))).toBeNull();
    expect(lineToInput(line({ quantity: "0" }))).toBeNull();
    expect(lineToInput(line({ unitAmount: "twelve" }))).toBeNull();
    expect(lineToInput(line({ totalAmount: "" }))).toBeNull();
  });
});

describe("proposalRequest", () => {
  it("is null until both totals parse (A-4: both are entered)", () => {
    expect(proposalRequest(ENQUIRY_ID, EMPTY_TOTALS, [])).toBeNull();
    expect(proposalRequest(ENQUIRY_ID, { ...TOTALS, internalTotal: "" }, [])).toBeNull();
  });

  it("builds the request: no margin, a null validity when none is typed, the parsed lines", () => {
    expect(proposalRequest(ENQUIRY_ID, TOTALS, [line()])).toEqual({
      enquiryId: ENQUIRY_ID,
      validUntil: null,
      clientTotal: { minor: 185_000_000, currency: "INR" },
      internalTotal: { minor: 170_000_000, currency: "INR" },
      lines: [lineToInput(line())],
    });
  });

  it("takes a real valid-until date and refuses an impossible one", () => {
    const valid = proposalRequest(ENQUIRY_ID, { ...TOTALS, validUntil: " 2027-01-31 " }, []);
    expect(valid?.validUntil).toBe("2027-01-31");
    expect(proposalRequest(ENQUIRY_ID, { ...TOTALS, validUntil: "2027-02-30" }, [])).toBeNull();
  });

  it("is null while any line is incomplete", () => {
    expect(
      proposalRequest(ENQUIRY_ID, TOTALS, [line(), line({ key: 1, quantity: "" })]),
    ).toBeNull();
  });
});

describe("quantityError", () => {
  it("asks for a quantity, then for one above zero", () => {
    expect(quantityError("")).toBe("Enter the quantity");
    expect(quantityError("0")).toBe("Enter a quantity above zero");
    expect(quantityError("1,200")).toBeUndefined();
  });
});

describe("clientLinesTotalMinor", () => {
  it("adds up the client-visible lines only", () => {
    const lines = [
      line(),
      line({ key: 1, totalAmount: "80000" }),
      line({ key: 2, clientVisible: false, totalAmount: "5000" }),
      line({ key: 3, clientVisible: null, totalAmount: "9000" }),
    ];
    expect(clientLinesTotalMinor(lines)).toBe(80_000_000);
  });

  it("waits until every client-visible total parses, so a half-typed line shows no sum", () => {
    expect(clientLinesTotalMinor([line(), line({ key: 1, totalAmount: "8,000" })])).toBe(
      72_800_000,
    );
    expect(clientLinesTotalMinor([line(), line({ key: 1, totalAmount: "" })])).toBeNull();
  });

  it("is null without a client-visible line", () => {
    expect(clientLinesTotalMinor([])).toBeNull();
    expect(clientLinesTotalMinor([line({ clientVisible: false })])).toBeNull();
  });
});

describe("draftFromProposal", () => {
  it("opens a saved draft as the form's text, lines in order with their visibility", () => {
    const { totals, lines } = draftFromProposal(
      proposalFixture({ lines: [CLIENT_LINE, INTERNAL_LINE] }),
    );
    expect(totals).toEqual({
      clientTotal: "1850000",
      internalTotal: "1700000",
      validUntil: "2027-01-31",
    });
    expect(lines.map((draft) => [draft.key, draft.description, draft.clientVisible])).toEqual([
      [0, "Deluxe rooms, 3 nights", true],
      [1, "Hotel commission", false],
    ]);
    expect(lines[0]).toMatchObject({ quantity: "60", unitAmount: "12000", totalAmount: "720000" });
  });

  it("leaves the internal total blank for a reader the API did not send it to", () => {
    expect(draftFromProposal(proposalWithoutGrant()).totals.internalTotal).toBe("");
  });
});

describe("proposalUpdateRequest", () => {
  const totals = { clientTotal: "18,50,000", internalTotal: "17,00,000", validUntil: "" };

  it("sends the whole draft back, a blank date clearing it", () => {
    expect(proposalUpdateRequest(totals, [line()], true)).toEqual({
      validUntil: null,
      clientTotal: { minor: 185_000_000, currency: "INR" },
      internalTotal: { minor: 170_000_000, currency: "INR" },
      lines: [lineToInput(line())],
    });
  });

  it("leaves the internal total out without the grant, needing none typed", () => {
    const request = proposalUpdateRequest({ ...totals, internalTotal: "" }, [], false);
    expect(request).not.toBeNull();
    expect(request).not.toHaveProperty("internalTotal");
  });

  it("is null while a field will not parse", () => {
    expect(proposalUpdateRequest({ ...totals, clientTotal: "" }, [], true)).toBeNull();
    expect(proposalUpdateRequest({ ...totals, internalTotal: "" }, [], true)).toBeNull();
    expect(proposalUpdateRequest(totals, [emptyLine(0)], true)).toBeNull();
  });
});
