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

/*
 * A submit and a withdrawal audit what they bound and took back (D-190 §3): the revision's number, the
 * SHA-256 its declarations bind to, and the consent kinds. Never an answer, a message or a name.
 */
describe("hotelFormAuditImage: a submit's and a withdrawal's facts", () => {
  const HASH = "0f".repeat(32);

  it("keeps a revision's number, a SHA-256 hash and the consent kinds", () => {
    expect(
      hotelFormAuditImage({
        id: ID,
        revision: 2,
        answersHash: HASH,
        kinds: ["accuracy_attestation", "display_authorisation"],
        kind: "privacy_notice",
      }),
    ).toEqual({
      id: ID,
      revision: 2,
      answersHash: HASH,
      kinds: ["accuracy_attestation", "display_authorisation"],
      kind: "privacy_notice",
    });
  });

  it("keeps the sessions a withdrawal of every consent ended, by their ids", () => {
    const image = {
      id: ID,
      endedSessionIds: [ID, "hfs_not-an-id"],
      changedFields: ["sessionEndedAt"],
    };
    expect(hotelFormAuditImage(image)).toEqual({
      id: ID,
      endedSessionIds: [ID],
      changedFields: ["sessionEndedAt"],
    });
  });

  it("drops a revision that is not a whole number from 1, and a hash that is not a SHA-256", () => {
    for (const revision of [0, -1, 1.5, "2", Number.NaN]) {
      expect(hotelFormAuditImage({ revision }), String(revision)).toEqual({});
    }
    for (const answersHash of [HASH.toUpperCase(), "0f".repeat(31), "Synthetic Person", 7]) {
      expect(hotelFormAuditImage({ answersHash }), String(answersHash)).toEqual({});
    }
    // A SECRET hash (a link's, a session's, a mobile's) is never kept, whatever its key ends with:
    // the masker hides it, as it always did.
    const secrets = hotelFormAuditImage({ tokenHash: HASH, destinationHash: HASH, codeHash: HASH });
    expect(JSON.stringify(secrets)).not.toContain(HASH);
  });

  it("keeps only consent kinds under kinds and kind, never typed text that looks like a name", () => {
    expect(
      hotelFormAuditImage({
        kinds: ["display_authorisation", "SyntheticPerson", "all", 3],
        kind: "Synthetic Person",
      }),
    ).toEqual({ kinds: ["display_authorisation"] });
  });

  it("still drops an answer, a correction's message and a removal's reason", () => {
    const image = hotelFormAuditImage({
      id: ID,
      answers: { name: "Synthetic Lake Palace" },
      message: "The lawn seats 900, not 600.",
      reason: "Please remove me",
    });
    expect(image).toEqual({ id: ID });
  });
});
