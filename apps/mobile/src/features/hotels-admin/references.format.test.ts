import {
  referenceConsentChip,
  referenceGuests,
  referencesClientView,
  referenceTitle,
  referenceVisibilityChip,
  shownSummary,
} from "./references.format";
import { CONSENT_DOCUMENT_ID, weddingReferenceFixture } from "./hotels-admin.test-utils";

const consented = weddingReferenceFixture({ consentDocumentId: CONSENT_DOCUMENT_ID });
const shown = weddingReferenceFixture({
  consentDocumentId: CONSENT_DOCUMENT_ID,
  clientVisible: true,
});

describe("references.format", () => {
  it("names a reference by its year and counts its guests", () => {
    expect(referenceTitle(weddingReferenceFixture())).toBe("2024 wedding");
    expect(referenceGuests(weddingReferenceFixture({ guestCount: 1200 }))).toBe("1,200 guests");
    expect(referenceGuests(weddingReferenceFixture({ guestCount: 1 }))).toBe("1 guest");
    expect(referenceGuests(weddingReferenceFixture({ guestCount: null }))).toBe(
      "Guest count not recorded",
    );
  });

  it("says in words whether clients see it and whether consent is on file", () => {
    expect(referenceVisibilityChip(weddingReferenceFixture())).toEqual({
      label: "Internal",
      tone: "neutral",
    });
    expect(referenceVisibilityChip(shown)).toEqual({ label: "Shown to clients", tone: "success" });
    expect(referenceConsentChip(weddingReferenceFixture())).toEqual({
      label: "No consent yet",
      tone: "warning",
    });
    expect(referenceConsentChip(consented)).toEqual({ label: "Consent on file", tone: "success" });
  });

  it("counts what clients see, what is ready to show and what still waits for consent", () => {
    const view = referencesClientView([weddingReferenceFixture(), consented, shown]);
    expect(view).toEqual({ shown: 1, total: 3, ready: 1, awaitingConsent: 1 });
    expect(shownSummary(view)).toBe("1 of 3 shown to clients");
    expect(shownSummary(referencesClientView([weddingReferenceFixture()]))).toBe(
      "None shown to clients yet",
    );
  });
});
