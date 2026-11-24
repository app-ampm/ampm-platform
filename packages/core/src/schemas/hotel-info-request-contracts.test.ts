import { describe, expect, it } from "vitest";

import {
  HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX,
  HOTEL_INFO_REQUEST_TEXT_MAX,
  hotelDuplicateHintsQuery,
  hotelInfoRequestCreateRequest,
  hotelInfoRequestHistoryQuery,
  hotelInfoRequestListQuery,
  hotelInfoRequestReissueRequest,
  hotelInfoRequestRevokeRequest,
  hotelInfoRequestShareRecordRequest,
  hotelInfoRequestUpdateRequest,
} from "./hotel-info-request-contracts";

/* The staff routes' request bodies and queries for hotel information requests (D-188 §3). */

const HOTEL = "0192f1a0-0000-7000-8000-0000000000a1";
const DESTINATION = "0192f1a0-0000-7000-8000-0000000000a2";

const existing = { target: "existing", hotelId: HOTEL } as const;
const proposed = {
  target: "new",
  proposedName: "Synthetic Lake Palace",
  proposedDestinationId: DESTINATION,
  proposedWebAddress: "https://www.synthetic-lake-palace.example",
} as const;

/** The paths of a failed parse's issues. */
function pathsOf(result: { error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join("."));
}

describe("hotelInfoRequestCreateRequest", () => {
  it("takes an existing hotel with only its id, as an onboarding, not emailed, not a test", () => {
    expect(hotelInfoRequestCreateRequest.parse(existing)).toEqual({
      ...existing,
      kind: "onboarding",
      emailIt: false,
      isTest: false,
    });
  });

  it("takes a new hotel's name, destination and web address, and every staff field, trimmed", () => {
    const parsed = hotelInfoRequestCreateRequest.parse({
      ...proposed,
      proposedName: "  Synthetic Lake Palace ",
      displayLabel: " Lake Palace refresh ",
      staffNote: "Met the sales team at a synthetic fair",
      officialWebsite: "synthetic-lake-palace.example",
      switchboardPhone: "0141-234 5678",
      switchboardSource: "The hotel's own contact page",
      recipientName: "Synthetic Sales Desk",
      recipientEmail: " Sales@Synthetic-Lake-Palace.Example ",
      emailIt: true,
    });
    expect(parsed).toMatchObject({
      target: "new",
      kind: "onboarding",
      proposedName: "Synthetic Lake Palace",
      displayLabel: "Lake Palace refresh",
      switchboardPhone: "+911412345678",
      recipientEmail: "sales@synthetic-lake-palace.example",
      emailIt: true,
      isTest: false,
    });
  });

  it("lets an existing hotel's request be a refresh, but a new hotel's only an onboarding", () => {
    expect(hotelInfoRequestCreateRequest.parse({ ...existing, kind: "refresh" }).kind).toBe(
      "refresh",
    );
    const refused = hotelInfoRequestCreateRequest.safeParse({ ...proposed, kind: "refresh" });
    expect(pathsOf(refused)).toEqual(["kind"]);
  });

  it("refuses a body that names no target, an unknown field, or the other target's fields", () => {
    expect(hotelInfoRequestCreateRequest.safeParse({ hotelId: HOTEL }).success).toBe(false);
    expect(pathsOf(hotelInfoRequestCreateRequest.safeParse({ ...existing, extra: 1 }))).toEqual([
      "",
    ]);
    const mixed = hotelInfoRequestCreateRequest.safeParse({ ...existing, proposedName: "X" });
    expect(mixed.success).toBe(false);
  });

  it("needs a recipient email to email the link", () => {
    const refused = hotelInfoRequestCreateRequest.safeParse({ ...existing, emailIt: true });
    expect(pathsOf(refused)).toEqual(["recipientEmail"]);
    const bad = hotelInfoRequestCreateRequest.safeParse({ ...existing, recipientEmail: "nope" });
    expect(pathsOf(bad)).toEqual(["recipientEmail"]);
  });

  it("stores the switchboard in E.164 and needs where it came from, and a source needs a number", () => {
    const noSource = hotelInfoRequestCreateRequest.safeParse({
      ...existing,
      switchboardPhone: "+91 141 234 5678",
    });
    expect(pathsOf(noSource)).toEqual(["switchboardSource"]);
    const noPhone = hotelInfoRequestCreateRequest.safeParse({
      ...existing,
      switchboardSource: "A synthetic directory",
    });
    expect(pathsOf(noPhone)).toEqual(["switchboardPhone"]);
    const extension = hotelInfoRequestCreateRequest.safeParse({
      ...existing,
      switchboardPhone: "+91 141 234 5678 ext 12",
      switchboardSource: "A synthetic directory",
    });
    expect(pathsOf(extension)).toEqual(["switchboardPhone"]);
  });

  it("refuses a web address that is not an http or https address", () => {
    for (const address of ["not a web address", "ftp://synthetic-hotel.example", ""]) {
      const result = hotelInfoRequestCreateRequest.safeParse({
        ...proposed,
        proposedWebAddress: address,
      });
      expect(pathsOf(result), address).toEqual(["proposedWebAddress"]);
    }
    const website = hotelInfoRequestCreateRequest.safeParse({
      ...existing,
      officialWebsite: "mailto:sales@synthetic-hotel.example",
    });
    expect(pathsOf(website)).toEqual(["officialWebsite"]);
  });

  it("refuses an empty label, note or name, and text with the null character", () => {
    for (const field of ["displayLabel", "staffNote", "recipientName", "switchboardSource"]) {
      const empty = hotelInfoRequestCreateRequest.safeParse({ ...existing, [field]: "  " });
      expect(empty.success, field).toBe(false);
    }
    const nul = hotelInfoRequestCreateRequest.safeParse({ ...existing, staffNote: "a\u0000b" });
    expect(pathsOf(nul)).toEqual(["staffNote"]);
    const long = "x".repeat(HOTEL_INFO_REQUEST_TEXT_MAX + 1);
    expect(hotelInfoRequestCreateRequest.safeParse({ ...existing, staffNote: long }).success).toBe(
      false,
    );
  });
});

describe("hotelInfoRequestUpdateRequest", () => {
  it("changes the label, note and recipient, a null clearing one", () => {
    const parsed = hotelInfoRequestUpdateRequest.parse({
      displayLabel: null,
      staffNote: "Chased by phone",
      recipientName: "Synthetic Front Office",
      recipientEmail: "Front@Synthetic-Hotel.Example",
    });
    expect(parsed).toEqual({
      displayLabel: null,
      staffNote: "Chased by phone",
      recipientName: "Synthetic Front Office",
      recipientEmail: "front@synthetic-hotel.example",
    });
  });

  it("extends by whole days up to the widest extension, or to a new expiry, never both", () => {
    expect(hotelInfoRequestUpdateRequest.parse({ extendDays: 14 })).toEqual({ extendDays: 14 });
    expect(hotelInfoRequestUpdateRequest.parse({ expiresAt: "2027-01-31T12:00:00Z" })).toEqual({
      expiresAt: "2027-01-31T12:00:00Z",
    });
    for (const extendDays of [0, 1.5, HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX + 1]) {
      expect(hotelInfoRequestUpdateRequest.safeParse({ extendDays }).success, `${extendDays}`).toBe(
        false,
      );
    }
    const both = hotelInfoRequestUpdateRequest.safeParse({
      extendDays: 7,
      expiresAt: "2027-01-31T12:00:00Z",
    });
    expect(pathsOf(both)).toEqual(["expiresAt"]);
  });

  it("refuses an empty change and a field it does not change", () => {
    expect(pathsOf(hotelInfoRequestUpdateRequest.safeParse({}))).toEqual([""]);
    expect(hotelInfoRequestUpdateRequest.safeParse({ status: "revoked" }).success).toBe(false);
    expect(hotelInfoRequestUpdateRequest.safeParse({ officialWebsite: null }).success).toBe(false);
  });
});

describe("the reissue, share-record and revoke bodies", () => {
  it("reissues without emailing unless asked", () => {
    expect(hotelInfoRequestReissueRequest.parse({})).toEqual({ emailIt: false });
    expect(hotelInfoRequestReissueRequest.parse({ emailIt: true })).toEqual({ emailIt: true });
    expect(hotelInfoRequestReissueRequest.safeParse({ link: "x" }).success).toBe(false);
  });

  it("records a WhatsApp, copy or other share with an optional note, never the link", () => {
    for (const channel of ["whatsapp", "copy", "other"]) {
      expect(hotelInfoRequestShareRecordRequest.parse({ channel })).toEqual({ channel });
    }
    expect(
      hotelInfoRequestShareRecordRequest.parse({ channel: "other", note: " Sent by SMS " }),
    ).toEqual({ channel: "other", note: "Sent by SMS" });
    expect(hotelInfoRequestShareRecordRequest.safeParse({ channel: "email" }).success).toBe(false);
    const withLink = hotelInfoRequestShareRecordRequest.safeParse({ channel: "copy", url: "x" });
    expect(withLink.success).toBe(false);
  });

  it("revokes only with a reason", () => {
    expect(hotelInfoRequestRevokeRequest.parse({ reason: " Wrong hotel " })).toEqual({
      reason: "Wrong hotel",
    });
    expect(hotelInfoRequestRevokeRequest.safeParse({}).success).toBe(false);
    expect(hotelInfoRequestRevokeRequest.safeParse({ reason: " " }).success).toBe(false);
  });
});

describe("the queries", () => {
  it("lists without tests by default, filtered by status and kind, from a cursor", () => {
    expect(hotelInfoRequestListQuery.parse({})).toEqual({ limit: 50, includeTests: false });
    expect(
      hotelInfoRequestListQuery.parse({
        status: "submitted",
        kind: "refresh",
        includeTests: "true",
        cursor: HOTEL,
        limit: "10",
      }),
    ).toEqual({
      status: "submitted",
      kind: "refresh",
      includeTests: true,
      cursor: HOTEL,
      limit: 10,
    });
    expect(hotelInfoRequestListQuery.safeParse({ includeTests: "yes" }).success).toBe(false);
    expect(hotelInfoRequestListQuery.safeParse({ status: "expired" }).success).toBe(false);
    expect(hotelInfoRequestListQuery.safeParse({ q: "lake" }).success).toBe(false);
  });

  it("pages a hotel's history from a cursor", () => {
    expect(hotelInfoRequestHistoryQuery.parse({})).toEqual({ limit: 50 });
    expect(hotelInfoRequestHistoryQuery.safeParse({ cursor: "not-a-uuid" }).success).toBe(false);
  });

  it("takes a name, a web address, both or neither for the duplicate hints", () => {
    expect(
      hotelDuplicateHintsQuery.parse({ name: " Lake Palace ", webAddress: "lake.example" }),
    ).toEqual({ name: "Lake Palace", webAddress: "lake.example" });
    expect(hotelDuplicateHintsQuery.parse({})).toEqual({});
    expect(hotelDuplicateHintsQuery.safeParse({ hotelId: HOTEL }).success).toBe(false);
  });
});
