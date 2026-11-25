import { describe, expect, it } from "vitest";

import { hotelFormAuditImage } from "./hotel-form-audit-image.js";

/*
 * What a hotel-form contributor's audit keeps of an image (D-180, D-189 §6): ids, the names of changed
 * fields and masked values; every other key is dropped. Synthetic values only.
 */

const ID = "0196a0b0-0000-7000-8000-00000000b001";
const OTHER_ID = "0196a0b0-0000-7000-8000-00000000b002";

describe("hotelFormAuditImage", () => {
  it("keeps ids, alone or listed, and the names of the changed fields", () => {
    expect(
      hotelFormAuditImage({
        id: ID,
        requestId: OTHER_ID,
        person_id: ID,
        fileIds: [ID, OTHER_ID],
        changedFields: ["fullName", "designation"],
      }),
    ).toEqual({
      id: ID,
      requestId: OTHER_ID,
      person_id: ID,
      fileIds: [ID, OTHER_ID],
      changedFields: ["fullName", "designation"],
    });
  });

  it("keeps a personal field only masked, and drops every other key", () => {
    const image = hotelFormAuditImage({
      id: ID,
      fullName: "Synthetic Person",
      designation: "General Manager",
      phone: "+919000000001",
      ipAddress: "203.0.113.9",
      claimedFullName: "Synthetic Claimant",
      staffNote: "free text a stranger typed",
      attempts: 2,
      granted: true,
      delivery: "screen",
      nested: { id: OTHER_ID, fullName: "Synthetic Person" },
      reference: "HIR-2026-0001",
    });
    expect(image).toEqual({
      id: ID,
      fullName: "[redacted]",
      designation: "[redacted]",
      phone: "[redacted]",
      ipAddress: "[redacted]",
      claimedFullName: "[redacted]",
    });
    expect(JSON.stringify(image)).not.toMatch(/Synthetic|free text|9000000001|203\.0\.113/);
  });

  it("drops an id key that does not hold an id, and a changed-field name that is not a name", () => {
    expect(
      hotelFormAuditImage({
        id: "HIR-2026-0001",
        personId: "Synthetic Person",
        fileIds: [ID, "not an id"],
        changedFields: ["fullName", "Synthetic Person wrote this", 7],
      }),
    ).toEqual({ fileIds: [ID], changedFields: ["fullName"] });
  });

  it("keeps a null id, and a value the caller masked already", () => {
    expect(hotelFormAuditImage({ personId: null, answer: "[redacted]" })).toEqual({
      personId: null,
      answer: "[redacted]",
    });
  });

  it("keeps an absent image absent and a null image null, and drops any image that is not an object", () => {
    expect(hotelFormAuditImage(undefined)).toBeUndefined();
    expect(hotelFormAuditImage(null)).toBeNull();
    for (const image of ["Synthetic Person", 42, true, [ID], new Date(0)]) {
      expect(hotelFormAuditImage(image), String(image)).toBeUndefined();
    }
  });
});
