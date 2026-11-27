import {
  formatDay,
  HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX,
  HOTEL_INFO_REQUEST_TEXT_MAX,
  hotelInfoRequestCreateRequest,
  hotelInfoRequestUpdateRequest,
  type HotelInfoRequestCreateRequestInput,
  type HotelInfoRequestFullView,
  type HotelInfoRequestKind,
  type HotelInfoRequestUpdateRequest,
} from "@ampm/core";

/*
 * The drafts of the request sheets (D-188 §7): Send request (an existing hotel), Invite a new hotel, the
 * edit and the extension. A body is built from what was filled in and checked by the core contract the
 * API enforces, its refusals placed under their fields in the sheet's words. No rendering, no I/O.
 */

/** What both create sheets take. */
export interface RequestDraft {
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly displayLabel: string;
  readonly staffNote: string;
  readonly kind: HotelInfoRequestKind;
  readonly officialWebsite: string;
  readonly switchboardPhone: string;
  readonly switchboardSource: string;
  readonly emailIt: boolean;
  readonly isTest: boolean;
}

/** What the Invite a new hotel sheet takes besides: the proposed hotel. */
export interface NewHotelDraft extends RequestDraft {
  readonly proposedName: string;
  readonly proposedDestinationId: string;
  readonly proposedWebAddress: string;
}

export const EMPTY_REQUEST_DRAFT: RequestDraft = {
  recipientName: "",
  recipientEmail: "",
  displayLabel: "",
  staffNote: "",
  kind: "onboarding",
  officialWebsite: "",
  switchboardPhone: "",
  switchboardSource: "",
  emailIt: false,
  isTest: false,
};

export const EMPTY_NEW_HOTEL_DRAFT: NewHotelDraft = {
  ...EMPTY_REQUEST_DRAFT,
  proposedName: "",
  proposedDestinationId: "",
  proposedWebAddress: "",
};

/**
 * Every field of either create sheet that can carry an error (the switches cannot): the one list the
 * form's checks and the API's refusals place errors by.
 */
export const REQUEST_FIELDS = [
  "recipientName",
  "recipientEmail",
  "displayLabel",
  "staffNote",
  "officialWebsite",
  "switchboardPhone",
  "switchboardSource",
  "proposedName",
  "proposedDestinationId",
  "proposedWebAddress",
] as const satisfies readonly Exclude<keyof NewHotelDraft, "kind" | "emailIt" | "isTest">[];

/** A field that can carry an error. */
export type RequestDraftField = (typeof REQUEST_FIELDS)[number];
/** A field that can carry an error, or the whole form. */
export type RequestField = RequestDraftField | "form";
export type RequestErrors = Partial<Record<RequestField, string>>;

/**
 * Whether a path's head names a field that can carry an error.
 *
 * @example
 * isRequestDraftField("recipientEmail"); // true; "emailIt" is a switch: false
 */
export function isRequestDraftField(head: unknown): head is RequestDraftField {
  return REQUEST_FIELDS.some((field) => field === head);
}

const WEB_ADDRESS = "Enter a web address such as https://www.hotel.example";
const EMAIL = "Enter an email such as sales@hotel.example";

/** A field's words in a length message. */
const FIELD_NAME: Partial<Record<RequestField, string>> = {
  displayLabel: "label",
  staffNote: "note",
  recipientName: "name",
  recipientEmail: "email",
  officialWebsite: "web address",
  switchboardSource: "source",
  proposedName: "name",
  proposedWebAddress: "website",
};

/** What a missing or unreadable value means, where the contract says nothing of its own. */
const FIELD_MESSAGE: Partial<Record<RequestField, string>> = {
  proposedName: "Enter the hotel's name",
  proposedDestinationId: "Choose the hotel's destination",
  proposedWebAddress: WEB_ADDRESS,
  officialWebsite: WEB_ADDRESS,
  recipientEmail: EMAIL,
};

/** What placing a refusal reads of the contract's issues. */
interface ContractIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  /** A length refusal's limit. */
  readonly maximum?: unknown;
}

function fieldOf(path: readonly PropertyKey[]): RequestField {
  const head = path[0];
  return isRequestDraftField(head) ? head : "form";
}

/** One refusal in the sheet's words: the contract's own message, a length, or the field's message. */
function messageOf(issue: ContractIssue, field: RequestField): string {
  if (issue.code === "custom") return issue.message;
  if (issue.code === "too_big") {
    return `Keep the ${FIELD_NAME[field] ?? "text"} to ${String(issue.maximum)} characters at most`;
  }
  return FIELD_MESSAGE[field] ?? "Check this field";
}

/** The issues of a failed parse, the first under each field. */
function placeIssues(issues: readonly ContractIssue[]): RequestErrors {
  const errors: RequestErrors = {};
  for (const issue of issues) {
    const field = fieldOf(issue.path);
    errors[field] ??= messageOf(issue, field);
  }
  return errors;
}

/** A trimmed text, or nothing when blank. */
function filled(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** The staff fields both sheets send: what was filled in, and the switches. */
function staffFields(draft: RequestDraft) {
  const fields = {
    displayLabel: filled(draft.displayLabel),
    staffNote: filled(draft.staffNote),
    officialWebsite: filled(draft.officialWebsite),
    switchboardPhone: filled(draft.switchboardPhone),
    switchboardSource: filled(draft.switchboardSource),
    recipientName: filled(draft.recipientName),
    recipientEmail: filled(draft.recipientEmail),
  };
  const given = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  return { ...given, emailIt: draft.emailIt, isTest: draft.isTest };
}

/**
 * The Send request body for a hotel the catalogue holds.
 *
 * @example
 * existingHotelBody(hotelId, { ...EMPTY_REQUEST_DRAFT, kind: "refresh" });
 */
export function existingHotelBody(
  hotelId: string,
  draft: RequestDraft,
): HotelInfoRequestCreateRequestInput {
  return { target: "existing", hotelId, kind: draft.kind, ...staffFields(draft) };
}

/**
 * The Invite a new hotel body: the proposed hotel, always its onboarding (the contract's rule), its
 * website left out when blank (D-192).
 */
export function newHotelBody(draft: NewHotelDraft): HotelInfoRequestCreateRequestInput {
  const website = filled(draft.proposedWebAddress);
  return {
    target: "new",
    proposedName: draft.proposedName.trim(),
    proposedDestinationId: draft.proposedDestinationId,
    ...(website === undefined ? {} : { proposedWebAddress: website }),
    ...staffFields(draft),
  };
}

/** The contract's refusals of a create body, each under its field; none when it would be accepted. */
export function requestErrors(body: HotelInfoRequestCreateRequestInput): RequestErrors {
  const parsed = hotelInfoRequestCreateRequest.safeParse(body);
  return parsed.success ? {} : placeIssues(parsed.error.issues);
}

/** The edit sheet's draft: the label, the note and the recipient. */
export interface EditDraft {
  readonly displayLabel: string;
  readonly staffNote: string;
  readonly recipientName: string;
  readonly recipientEmail: string;
}

const EDITABLE = ["displayLabel", "staffNote", "recipientName", "recipientEmail"] as const;

export function editDraftFrom(request: HotelInfoRequestFullView): EditDraft {
  return {
    displayLabel: request.displayLabel ?? "",
    staffNote: request.staffNote ?? "",
    recipientName: request.recipientName ?? "",
    recipientEmail: request.recipientEmail ?? "",
  };
}

/** What the edit changes: each field that differs, a blank as null (a clear). */
export function editBody(
  request: HotelInfoRequestFullView,
  draft: EditDraft,
): HotelInfoRequestUpdateRequest {
  const body: Record<string, string | null> = {};
  for (const field of EDITABLE) {
    const next = filled(draft[field]) ?? null;
    if (next !== request[field]) body[field] = next;
  }
  return body;
}

/** The contract's refusals of an edit, and a nothing-changed note for an empty one. */
export function editErrors(body: HotelInfoRequestUpdateRequest): RequestErrors {
  if (Object.keys(body).length === 0) return { form: "Nothing has changed" };
  const parsed = hotelInfoRequestUpdateRequest.safeParse(body);
  return parsed.success ? {} : placeIssues(parsed.error.issues);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_MESSAGE = `Enter a number of days from 1 to ${HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX}`;

/** An extension the sheet can send, or why it cannot. */
export interface ExtendPreview {
  readonly days?: number;
  /** The new expiry, as the API will set it. */
  readonly expiresAt?: string;
  readonly error?: string;
}

/**
 * The expiry an extension by `daysText` sets, as the API works it out: the days added to the later of now
 * and the current expiry, held to `extendableUntil`.
 *
 * @example
 * extendPreview(request, "14", new Date()); // { days: 14, expiresAt: "2027-01-07T10:00:00.000Z" }
 */
export function extendPreview(
  request: Pick<HotelInfoRequestFullView, "expiresAt" | "extendableUntil">,
  daysText: string,
  now: Date,
): ExtendPreview {
  const text = daysText.trim();
  const days = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!(days >= 1 && days <= HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX)) return { error: DAYS_MESSAGE };
  if (request.extendableUntil === null) return { error: "This request can no longer be extended" };
  const current = new Date(request.expiresAt).getTime();
  const next = new Date(Math.max(current, now.getTime()) + days * DAY_MS);
  if (next.getTime() > new Date(request.extendableUntil).getTime()) {
    return {
      error: `This link can be extended to ${formatDay(request.extendableUntil)} at the latest`,
    };
  }
  return { days, expiresAt: next.toISOString() };
}

/** Why a revoke cannot go yet: its reason is required. */
export function revokeReasonError(reason: string): string | undefined {
  const text = reason.trim();
  if (text === "") return "Say why the request is revoked";
  if (text.length > HOTEL_INFO_REQUEST_TEXT_MAX) {
    return `Keep the reason to ${HOTEL_INFO_REQUEST_TEXT_MAX.toLocaleString("en-IN")} characters at most`;
  }
  return undefined;
}
