import type { WeddingReferenceView } from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/*
 * The words of the staff References tab (TW-22): a previous wedding at the hotel, whether its couple's
 * consent is on file, and whether clients see it (GP-20). Pure; tested beside it.
 */

export interface ReferenceChip {
  readonly label: string;
  readonly tone: StatusTone;
}

/** "2024 wedding": a reference has no name of its own, so its year names it. */
export function referenceTitle(reference: WeddingReferenceView): string {
  return `${reference.eventYear} wedding`;
}

/** "320 guests", or what is missing. */
export function referenceGuests(reference: WeddingReferenceView): string {
  const count = reference.guestCount;
  if (count === null) return "Guest count not recorded";
  return count === 1 ? "1 guest" : `${count.toLocaleString("en-IN")} guests`;
}

/** Whether clients see the reference on the hotel page: peacock when shown, neutral while internal. */
export function referenceVisibilityChip(reference: WeddingReferenceView): ReferenceChip {
  return reference.clientVisible
    ? { label: "Shown to clients", tone: "success" }
    : { label: "Internal", tone: "neutral" };
}

/** Whether the couple's consent is on file: without it the reference can never be shown (GP-20). */
export function referenceConsentChip(reference: WeddingReferenceView): ReferenceChip {
  return reference.consentDocumentId
    ? { label: "Consent on file", tone: "success" }
    : { label: "No consent yet", tone: "warning" };
}

export interface ReferencesClientView {
  readonly shown: number;
  readonly total: number;
  /** Internal references whose consent is on file: ready to show when staff choose to. */
  readonly ready: number;
  /** References still waiting for the couple's consent. */
  readonly awaitingConsent: number;
}

/** The side panel's counts: what clients see today and what could follow. */
export function referencesClientView(
  references: readonly WeddingReferenceView[],
): ReferencesClientView {
  const shown = references.filter((r) => r.clientVisible).length;
  const ready = references.filter((r) => !r.clientVisible && r.consentDocumentId).length;
  const awaitingConsent = references.filter((r) => !r.consentDocumentId).length;
  return { shown, total: references.length, ready, awaitingConsent };
}

/** "2 of 5 shown to clients", or "None shown to clients yet". */
export function shownSummary(view: ReferencesClientView): string {
  if (view.shown === 0) return "None shown to clients yet";
  return `${view.shown} of ${view.total} shown to clients`;
}
