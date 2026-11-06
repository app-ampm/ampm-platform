import { describe, expect, it } from "vitest";

import {
  weddingReferenceClientItem,
  weddingReferenceCreateRequest,
  weddingReferenceUpdateRequest,
} from "./hotel-references.js";

const DOC = "0192f1a0-0000-7000-8000-00000000d0c1";

describe("weddingReferenceCreateRequest", () => {
  it("requires a four-digit event year and defaults clientVisible to false", () => {
    const parsed = weddingReferenceCreateRequest.parse({ eventYear: 2025 });
    expect(parsed.clientVisible).toBe(false);
    expect(weddingReferenceCreateRequest.safeParse({}).success).toBe(false);
  });

  it("bounds the event year and rejects a non-integer", () => {
    expect(weddingReferenceCreateRequest.safeParse({ eventYear: 1899 }).success).toBe(false);
    expect(weddingReferenceCreateRequest.safeParse({ eventYear: 2101 }).success).toBe(false);
    expect(weddingReferenceCreateRequest.safeParse({ eventYear: 2025.5 }).success).toBe(false);
  });

  it("rejects a negative guest count and accepts zero or null", () => {
    expect(
      weddingReferenceCreateRequest.safeParse({ eventYear: 2025, guestCount: -1 }).success,
    ).toBe(false);
    expect(
      weddingReferenceCreateRequest.safeParse({ eventYear: 2025, guestCount: 0 }).success,
    ).toBe(true);
    expect(
      weddingReferenceCreateRequest.safeParse({ eventYear: 2025, guestCount: null }).success,
    ).toBe(true);
  });

  it("caps the client description at 10,000 characters", () => {
    const tooLong = { eventYear: 2025, descriptionClient: "x".repeat(10_001) };
    expect(weddingReferenceCreateRequest.safeParse(tooLong).success).toBe(false);
  });

  it("is strict — an unknown field is rejected", () => {
    expect(weddingReferenceCreateRequest.safeParse({ eventYear: 2025, hotelId: DOC }).success).toBe(
      false,
    );
  });
});

describe("weddingReferenceUpdateRequest", () => {
  it("rejects an empty patch and accepts a single field (no create default leaks)", () => {
    expect(weddingReferenceUpdateRequest.safeParse({}).success).toBe(false);
    expect(weddingReferenceUpdateRequest.safeParse({ clientVisible: true }).success).toBe(true);
  });

  it("lets a patch clear the consent document explicitly (nullable)", () => {
    expect(weddingReferenceUpdateRequest.safeParse({ consentDocumentId: null }).success).toBe(true);
  });
});

describe("weddingReferenceClientItem", () => {
  it("is strict and carries only the social-proof content — never a governance key", () => {
    const base = {
      id: DOC,
      eventYear: 2025,
      guestCount: 300,
      descriptionClient: "A grand wedding",
    };
    expect(weddingReferenceClientItem.safeParse(base).success).toBe(true);
    // No consentDocumentId / projectId / clientVisible / hotelId may ride along.
    expect(weddingReferenceClientItem.safeParse({ ...base, consentDocumentId: DOC }).success).toBe(
      false,
    );
    expect(weddingReferenceClientItem.safeParse({ ...base, clientVisible: true }).success).toBe(
      false,
    );
  });
});
