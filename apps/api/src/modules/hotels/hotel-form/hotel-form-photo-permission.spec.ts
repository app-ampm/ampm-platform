import { describe, expect, it } from "vitest";

import { photoPermissionOf, type DisplayConsentRow } from "./hotel-form-photo-permission.js";

/*
 * A signed-in person's own answer to 7.5 (D-190 §3), as HF-07 reads it from `me`: their newest display
 * consent not withdrawn (newest by recordedAt, then id) says yes or no; none when they hold no such
 * consent. Synthetic rows only.
 */

const AT = new Date("2026-11-26T10:00:00.000Z");
const LATER = new Date("2026-11-26T11:00:00.000Z");

function consent(overrides: Partial<DisplayConsentRow> = {}): DisplayConsentRow {
  return {
    id: "0192f1a0-0000-7000-8000-0000000000d1",
    granted: true,
    recordedAt: AT,
    withdrawnAt: null,
    ...overrides,
  };
}

describe("photoPermissionOf", () => {
  it("answers yes for a Yes still on record", () => {
    expect(photoPermissionOf([consent()])).toBe("yes");
  });

  it("answers no for a No still on record", () => {
    expect(photoPermissionOf([consent({ granted: false })])).toBe("no");
  });

  it("answers none when the person holds no display consent", () => {
    expect(photoPermissionOf([])).toBe("none");
  });

  it("answers none for a Yes the person later withdrew", () => {
    expect(photoPermissionOf([consent({ withdrawnAt: LATER })])).toBe("none");
  });

  it("answers no for a Yes on one revision followed by a No on the next, in either order read", () => {
    const yes = consent({ id: "0192f1a0-0000-7000-8000-0000000000d1", recordedAt: AT });
    const no = consent({
      id: "0192f1a0-0000-7000-8000-0000000000d2",
      granted: false,
      recordedAt: LATER,
    });
    expect(photoPermissionOf([yes, no])).toBe("no");
    expect(photoPermissionOf([no, yes])).toBe("no");
  });

  it("breaks a tie on recordedAt by the newer id, and skips a withdrawn newer answer", () => {
    const first = consent({ id: "0192f1a0-0000-7000-8000-0000000000d1", granted: false });
    const second = consent({ id: "0192f1a0-0000-7000-8000-0000000000d2", granted: true });
    expect(photoPermissionOf([second, first])).toBe("yes");
    const withdrawnNo = consent({
      id: "0192f1a0-0000-7000-8000-0000000000d3",
      granted: false,
      recordedAt: LATER,
      withdrawnAt: LATER,
    });
    expect(photoPermissionOf([first, second, withdrawnNo])).toBe("yes");
  });
});
