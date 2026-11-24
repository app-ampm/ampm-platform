import {
  formatDay,
  formatMoment,
  isLiveHotelInfoRequestStatus,
  type HotelDuplicateHint,
  type HotelDuplicateHintReason,
  type HotelFormMode,
  type HotelInfoRequestActorKind,
  type HotelInfoRequestDetail,
  type HotelInfoRequestEventView,
  type HotelInfoRequestKind,
  type HotelInfoRequestLinkEmail,
  type HotelInfoRequestShareChannel,
  type HotelInfoRequestStatus,
  type HotelInfoRequestSummaryView,
} from "@ampm/core";
import type { CalloutKind, StatusTone } from "@ampm/ui";

/*
 * How hotel information requests read on the staff screens (D-188 §7): statuses, kinds and channels in
 * words; a request's expiry, the hotel form's mode and what became of a link's email as sentences; a
 * history line per event; why a hotel is a duplicate hint. No rendering, no fetching.
 */

const STATUS_LABEL: Record<HotelInfoRequestStatus, string> = {
  open: "Open",
  submitted: "Submitted",
  in_review: "In review",
  changes_requested: "Changes requested",
  merged: "Merged",
  rejected: "Rejected",
  revoked: "Revoked",
};

/** Waiting on the hotel is gold glass; the Hotel team's turn is the solid needs-you chip. */
const STATUS_TONE: Record<HotelInfoRequestStatus, StatusTone> = {
  open: "warning",
  submitted: "danger",
  in_review: "info",
  changes_requested: "warning",
  merged: "success",
  rejected: "neutral",
  revoked: "neutral",
};

export function infoRequestStatusLabel(status: HotelInfoRequestStatus): string {
  return STATUS_LABEL[status];
}

export function infoRequestStatusTone(status: HotelInfoRequestStatus): StatusTone {
  return STATUS_TONE[status];
}

const KIND_LABEL: Record<HotelInfoRequestKind, string> = {
  onboarding: "Onboarding",
  refresh: "Refresh",
};

export function infoRequestKindLabel(kind: HotelInfoRequestKind): string {
  return KIND_LABEL[kind];
}

const CHANNEL_LABEL: Record<HotelInfoRequestShareChannel, string> = {
  whatsapp: "WhatsApp",
  copy: "Copy",
  other: "Another way",
};

export function shareChannelLabel(channel: HotelInfoRequestShareChannel): string {
  return CHANNEL_LABEL[channel];
}

/** The catalogue's name for the hotel, or a new hotel's proposed name. */
export function infoRequestHotelName(request: HotelInfoRequestSummaryView): string {
  return request.hotelName ?? request.proposedName ?? request.reference;
}

/** A screen reader's summary of a queue row: reference, hotel, place, status, expiry, test. */
export function requestRowSummary(request: HotelInfoRequestSummaryView): string {
  const parts = [request.reference, infoRequestHotelName(request)];
  if (request.destinationName) parts.push(request.destinationName);
  parts.push(infoRequestStatusLabel(request.status).toLowerCase());
  if (isLiveHotelInfoRequestStatus(request.status) && request.isExpired) {
    parts.push("link expired");
  }
  if (request.isTest) parts.push("test request");
  return parts.join(", ");
}

/** Whether a live request's link has passed its expiry. */
export function isLinkExpired(request: HotelInfoRequestSummaryView): boolean {
  return isLiveHotelInfoRequestStatus(request.status) && request.isExpired;
}

/** Until when a live link works, since when it has not, or why it no longer opens the form. */
export function expiryText(request: HotelInfoRequestSummaryView): string {
  if (isLiveHotelInfoRequestStatus(request.status)) {
    const day = formatDay(request.expiresAt);
    return request.isExpired ? `Link expired on ${day}` : `Link valid until ${day}`;
  }
  if (request.status === "revoked" && request.revokedAt) {
    return `Link revoked on ${formatDay(request.revokedAt)}`;
  }
  if (request.statusOnlyUntil) {
    return `Status only until ${formatDay(request.statusOnlyUntil)}`;
  }
  return "The link no longer opens the form";
}

/** The live request of a hotel's history, else its latest; null when it has none. */
export function currentRequestOf(
  requests: readonly HotelInfoRequestSummaryView[],
): HotelInfoRequestSummaryView | null {
  return (
    requests.find((request) => isLiveHotelInfoRequestStatus(request.status)) ?? requests[0] ?? null
  );
}

/** What the hotel form's mode means for a request's link and its email. */
export interface FormModeNotice {
  readonly kind: CalloutKind;
  readonly title: string;
  readonly description: string;
}

/**
 * The notice the sheets show beside "Email it": what the mode lets reach the hotel, for a test request
 * or another.
 *
 * @example
 * formModeNotice("test_only", false).title; // "The hotel form is in test mode"
 */
export function formModeNotice(mode: HotelFormMode, isTest: boolean): FormModeNotice {
  if (mode === "on") {
    return {
      kind: "success",
      title: "The hotel form is on",
      description: "The link opens the form, and Email it sends it to the recipient.",
    };
  }
  if (mode === "test_only") {
    return {
      kind: "warning",
      title: "The hotel form is in test mode",
      description: isTest
        ? "This test request's link opens the form, and Email it sends it."
        : "Only test requests reach a hotel: this link is not emailed and opens nothing until the form is on.",
    };
  }
  return {
    kind: "warning",
    title: "The hotel form is off",
    description:
      "No email reaches a hotel and the link opens nothing until a Super Admin switches the form on. You can still prepare the request and keep its link.",
  };
}

/** What became of a link's email, after a create or a reissue. */
export function emailOutcomeText(
  email: HotelInfoRequestLinkEmail,
  request: HotelInfoRequestDetail,
): string {
  if (email === "queued") {
    const to = "recipientEmail" in request ? request.recipientEmail : null;
    return `Emailed to ${to ?? "the recipient"}.`;
  }
  if (email === "mode_off") return "Not emailed: the hotel form is off. Keep the link to share it.";
  if (email === "mode_test_only") {
    return "Not emailed: in test mode only test requests are emailed.";
  }
  if (email === "failed") {
    return "The email could not be queued. Copy or share the link, or reissue it with Email it.";
  }
  return "Not emailed.";
}

const ACTOR: Record<HotelInfoRequestActorKind, string> = {
  staff: "Staff",
  hotel_person: "The hotel",
  system: "System",
};

const FIELD_NAME: Record<string, string> = {
  displayLabel: "label",
  staffNote: "note",
  recipientName: "recipient name",
  recipientEmail: "recipient email",
};

/** "a", "a and b", "a, b and c". */
function listInWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}

function textOf(detail: HotelInfoRequestEventView["detail"], key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" ? value : null;
}

/** What an event did, from its type and its masked detail. */
function eventWhat(event: HotelInfoRequestEventView): string {
  const { detail } = event;
  switch (event.eventType) {
    case "created":
      return "Request created";
    case "link_reissued":
      return `New link issued (link ${String(detail?.["generation"] ?? "")})`;
    case "link_emailed":
      return "Link emailed";
    case "share_recorded": {
      const channel = textOf(detail, "channel");
      if (channel === "whatsapp") return "Shared on WhatsApp";
      return channel === "copy" ? "Shared by copy" : "Shared another way";
    }
    case "updated": {
      const fields = Array.isArray(detail?.["fields"]) ? detail["fields"] : [];
      return `Edited the ${listInWords(fields.map((field) => FIELD_NAME[field] ?? field))}`;
    }
    case "expiry_extended": {
      const to = textOf(detail, "to");
      return to ? `Extended to ${formatDay(to)}` : "Link extended";
    }
    case "revoked":
      return textOf(detail, "cause") === "hotel_deleted"
        ? "Revoked: the hotel was deleted"
        : "Revoked";
  }
}

/** One history line: what happened, when, and who did it. */
export function eventLine(event: HotelInfoRequestEventView): string {
  return `${eventWhat(event)} · ${formatMoment(event.occurredAt)} · ${ACTOR[event.actorKind]}`;
}

const HINT_REASON: Record<HotelDuplicateHintReason, string> = {
  name: "Same name",
  name_variant: "Same as one of its other names",
  web_address: "Same web address",
  website_host: "Same website host",
};

/** Why a hotel is a duplicate hint; a shared host is weak evidence, and a deleted hotel says so. */
export function duplicateHintReasons(hint: HotelDuplicateHint): string {
  const reasons = hint.reasons.map((reason) =>
    reason === "website_host" && hint.sharedHost
      ? `${HINT_REASON[reason]}, shared by several hotels`
      : HINT_REASON[reason],
  );
  if (hint.deletedAt) reasons.push(`Deleted ${formatDay(hint.deletedAt)}`);
  return reasons.join(" · ");
}
