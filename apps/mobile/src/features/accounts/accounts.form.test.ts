import {
  buildPaymentBody,
  emptyPaymentDraft,
  hasPaymentErrors,
  validatePayment,
} from "./accounts.form";

describe("record-payment form", () => {
  it("defaults to a blank bank-transfer draft", () => {
    expect(emptyPaymentDraft()).toEqual({ reference: "", method: "bank_transfer", paidAt: "" });
  });

  it("requires a reference and rejects a malformed date", () => {
    expect(
      hasPaymentErrors(
        validatePayment({ reference: "UTR123", method: "bank_transfer", paidAt: "" }),
      ),
    ).toBe(false);
    expect(validatePayment({ ...emptyPaymentDraft(), reference: " " }).reference).toBeDefined();
    expect(
      validatePayment({ reference: "x", method: "upi", paidAt: "01-2027" }).paidAt,
    ).toBeDefined();
  });

  it("builds the body: trims the reference, omits a blank date, sends a set date as midnight UTC", () => {
    expect(buildPaymentBody({ reference: " UTR 9 ", method: "upi", paidAt: "" })).toEqual({
      reference: "UTR 9",
      method: "upi",
    });
    expect(buildPaymentBody({ reference: "x", method: "cheque", paidAt: "2027-01-05" })).toEqual({
      reference: "x",
      method: "cheque",
      paidAt: "2027-01-05T00:00:00.000Z",
    });
  });
});
