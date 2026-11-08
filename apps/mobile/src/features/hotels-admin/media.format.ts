import type {
  MediaAssetView,
  MediaRightsStatus,
  MediaScanStatus,
  MediaVisibility,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/*
 * Presentation helpers for the hotel photo manager (H1.1): how a photo's scan state, who-can-see-it and
 * rights read, and the option lists the staff pick from. No fetching, no rules — the GP-20 gate is the
 * server's; `rightsClearedForClients` only mirrors it to warn before a rejected save.
 */

const SCAN_LABEL: Record<MediaScanStatus, string> = {
  pending: "Scanning",
  clean: "Ready",
  rejected: "Rejected",
};
const SCAN_TONE: Record<MediaScanStatus, StatusTone> = {
  pending: "warning",
  clean: "success",
  rejected: "danger",
};
export function scanStatusLabel(status: MediaScanStatus): string {
  return SCAN_LABEL[status];
}
export function scanStatusTone(status: MediaScanStatus): StatusTone {
  return SCAN_TONE[status];
}

const VISIBILITY_LABEL: Record<MediaVisibility, string> = {
  internal: "Internal only",
  client: "Clients",
  demo: "Demo",
  public: "Public",
};
const VISIBILITY_TONE: Record<MediaVisibility, StatusTone> = {
  internal: "neutral",
  client: "brand",
  demo: "info",
  public: "brand",
};
export function visibilityLabel(visibility: MediaVisibility): string {
  return VISIBILITY_LABEL[visibility];
}
export function visibilityTone(visibility: MediaVisibility): StatusTone {
  return VISIBILITY_TONE[visibility];
}

const RIGHTS_LABEL: Record<MediaRightsStatus, string> = {
  owned: "Owned",
  licensed: "Licensed",
  consent_required: "Consent needed",
  consent_obtained: "Consent on file",
};
const RIGHTS_TONE: Record<MediaRightsStatus, StatusTone> = {
  owned: "success",
  licensed: "success",
  consent_required: "warning",
  consent_obtained: "success",
};
export function rightsLabel(rights: MediaRightsStatus): string {
  return RIGHTS_LABEL[rights];
}
export function rightsTone(rights: MediaRightsStatus): StatusTone {
  return RIGHTS_TONE[rights];
}

/** The options the staff picker offers, each enum in a sensible order. */
export const VISIBILITY_OPTIONS: readonly MediaVisibility[] = [
  "internal",
  "client",
  "demo",
  "public",
];
export const RIGHTS_OPTIONS: readonly MediaRightsStatus[] = [
  "owned",
  "licensed",
  "consent_obtained",
  "consent_required",
];

/** Whether a photo's rights are cleared enough to be shown to clients (GP-20, mirrored from the server). */
export function rightsClearedForClients(rights: MediaRightsStatus): boolean {
  return rights === "owned" || rights === "licensed" || rights === "consent_obtained";
}

/** Whether a chosen visibility is client-facing (anything beyond internal). */
export function isClientFacing(visibility: MediaVisibility): boolean {
  return visibility !== "internal";
}

/** A screen-reader summary of one photo row. */
export function mediaSummary(media: MediaAssetView): string {
  return `${media.caption ?? "Untitled photo"}, ${scanStatusLabel(media.scanStatus)}, visible to ${visibilityLabel(
    media.visibility,
  ).toLowerCase()}`;
}
