import { z } from "zod";

import { normaliseHotelPhone } from "../hotel-phone.js";
import { normaliseWebAddress } from "../web-address.js";
import { cursorQuery, isoDateTime, storableText, uuid } from "./common.js";
import { hotelInfoRequestKind, hotelInfoRequestStatus } from "./hotel-info-requests.js";

/*
 * What the staff routes of hotel information requests take (D-188 §3; plan §7.2): the create, update,
 * reissue, share-record and revoke bodies, the inbox and history queries, and the duplicate hints' query.
 * Every body and query is strict: a field a route does not take is refused, the link's secret among them;
 * and a label or note that holds a pasted link is refused too. The answers are in
 * hotel-info-request-views.ts.
 */

/** The longest staff note and revoke reason (docs/field-matrix.md: text, up to 10,000 characters). */
export const HOTEL_INFO_REQUEST_TEXT_MAX = 10_000;
/** The longest note on a recorded share. */
export const HOTEL_INFO_REQUEST_SHARE_NOTE_MAX = 500;
/**
 * The most days one extension adds: `hotel_form.policy.maxExtensionDays` at its widest. The API holds the
 * total to the configured value past the first expiry.
 */
export const HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX = 60;

/** What a label or note holding a pasted hotel form link is refused with. */
export const HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL =
  "Remove the link: a label or note is seen by everyone who reads the request";

const WEB_ADDRESS_REFUSAL = "Enter a web address such as https://www.hotel.example";
const SWITCHBOARD_REFUSAL = "Enter the switchboard's full number, such as +91 141 234 5678";

/**
 * A hotel form link pasted into free text (D-188 §4): its secret, `hfl_` and a base64url run long enough
 * to be one, or its `#k=` fragment. A label or note is read by everyone who reads the request, while the
 * link goes to the hotel alone and is shown to staff once.
 */
const PASTED_LINK = /hfl_[A-Za-z0-9_-]{20,}|#k=/;

/** Text that holds no pasted hotel form link. */
function linkFree<T extends z.ZodString>(text: T): T {
  return text.refine((value) => !PASTED_LINK.test(value), {
    error: HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL,
  });
}

/** A label, a name or a source: trimmed, 1 to 255 characters. */
const shortText = storableText().min(1).max(255);
/** A staff note or a reason: trimmed, 1 to 10,000 characters. */
const longText = storableText().min(1).max(HOTEL_INFO_REQUEST_TEXT_MAX);
/** The staff label shown in emails and lists: a short text with no pasted link. */
const displayLabel = linkFree(shortText);
/** The staff note: a long text with no pasted link. */
const staffNote = linkFree(longText);
/** The recipient's email as AMPM enters it, stored lower-case (RESTRICTED-CONTACT). */
const recipientEmail = z.string().trim().toLowerCase().email().max(255);
/**
 * An http or https address as staff type it, kept as typed; its key is core `normaliseWebAddress`. Empty
 * text is left to the length check, so it is refused once.
 */
const webAddress = shortText.refine((text) => text === "" || normaliseWebAddress(text) !== null, {
  error: WEB_ADDRESS_REFUSAL,
});
/**
 * A new hotel's website, which staff may not know when they invite it (D-192): blank text, as an empty
 * field sends it, reads as none given; any other text is checked as `webAddress`.
 */
const optionalWebAddress = z
  .preprocess(
    (value: string | undefined) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    webAddress.optional(),
  )
  .optional();
/** The hotel's switchboard, stored in E.164 by core `normaliseHotelPhone`. */
const switchboardPhone = storableText()
  .max(40)
  .transform((text, ctx) => {
    const e164 = normaliseHotelPhone(text);
    if (e164 === null) {
      ctx.addIssue({ code: "custom", message: SWITCHBOARD_REFUSAL });
      return z.NEVER;
    }
    return e164;
  });

/** What a request carries beyond its target, all optional at creation. */
const createFields = {
  /** The staff label shown in emails and lists. */
  displayLabel: displayLabel.optional(),
  staffNote: staffNote.optional(),
  /** The hotel's official website, as AMPM's own reference. */
  officialWebsite: webAddress.optional(),
  switchboardPhone: switchboardPhone.optional(),
  /** Where staff found the switchboard number: required with it. */
  switchboardSource: shortText.optional(),
  recipientName: shortText.optional(),
  recipientEmail: recipientEmail.optional(),
  /** Email the link to `recipientEmail` when the hotel form's mode admits the request. */
  emailIt: z.boolean().default(false),
  /** A Super Admin's test request, for a draft hotel or a new hotel only. */
  isTest: z.boolean().default(false),
};

/** A request for a hotel the catalogue holds: its first onboarding or a seasonal refresh. */
const existingHotelRequest = z
  .object({
    target: z.literal("existing"),
    hotelId: uuid,
    kind: hotelInfoRequestKind.default("onboarding"),
    ...createFields,
  })
  .strict();

/**
 * A request for a proposed new hotel: always its onboarding. Its name and destination are required, its
 * website optional (D-192): when given it keys the one live request per address.
 */
const newHotelRequest = z
  .object({
    target: z.literal("new"),
    proposedName: shortText,
    proposedDestinationId: uuid,
    proposedWebAddress: optionalWebAddress,
    kind: z
      .literal("onboarding", { error: "A new hotel's request is its onboarding" })
      .default("onboarding"),
    ...createFields,
  })
  .strict();

/**
 * `POST /hotels-admin/info-requests`: an existing hotel (`hotelId`) or a proposed new one (its name and
 * destination, and its website when staff know it), with the staff fields. Emailing the link needs a recipient email, and a
 * switchboard number its source (and a source its number).
 *
 * @example
 * hotelInfoRequestCreateRequest.parse({ target: "existing", hotelId });
 * // { target: "existing", hotelId, kind: "onboarding", emailIt: false, isTest: false }
 */
export const hotelInfoRequestCreateRequest = z
  .discriminatedUnion("target", [existingHotelRequest, newHotelRequest])
  .superRefine((body, ctx) => {
    if (body.emailIt && body.recipientEmail === undefined) {
      const message = "Enter the recipient's email to email the link";
      ctx.addIssue({ code: "custom", path: ["recipientEmail"], message });
    }
    if (body.switchboardPhone !== undefined && body.switchboardSource === undefined) {
      const message = "Say where the switchboard number came from";
      ctx.addIssue({ code: "custom", path: ["switchboardSource"], message });
    }
    if (body.switchboardSource !== undefined && body.switchboardPhone === undefined) {
      const message = "Enter the switchboard number this source is for";
      ctx.addIssue({ code: "custom", path: ["switchboardPhone"], message });
    }
  });
/** The create body as the API reads it, its defaults filled in. */
export type HotelInfoRequestCreateRequest = z.output<typeof hotelInfoRequestCreateRequest>;
/** The create body as a client sends it. */
export type HotelInfoRequestCreateRequestInput = z.input<typeof hotelInfoRequestCreateRequest>;

/**
 * `PATCH /hotels-admin/info-requests/:id`: the label, the note and the recipient (null clears one), and
 * an extension, by whole days from the later of now and the current expiry, or to a new expiry: never
 * both. The API holds an extension to `maxExtensionDays` past the first expiry.
 *
 * @example
 * hotelInfoRequestUpdateRequest.parse({ extendDays: 14, displayLabel: null });
 */
export const hotelInfoRequestUpdateRequest = z
  .object({
    displayLabel: displayLabel.nullable().optional(),
    staffNote: staffNote.nullable().optional(),
    recipientName: shortText.nullable().optional(),
    recipientEmail: recipientEmail.nullable().optional(),
    extendDays: z.number().int().min(1).max(HOTEL_INFO_REQUEST_EXTEND_DAYS_MAX).optional(),
    expiresAt: isoDateTime.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (Object.values(body).every((value) => value === undefined)) {
      ctx.addIssue({ code: "custom", path: [], message: "Change at least one field" });
    }
    if (body.extendDays !== undefined && body.expiresAt !== undefined) {
      const message = "Extend by days or to a new expiry, not both";
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message });
    }
  });
export type HotelInfoRequestUpdateRequest = z.infer<typeof hotelInfoRequestUpdateRequest>;

/**
 * `POST …/:id/reissue`: a new link replaces the old one, which stops working; emailed only when asked.
 *
 * @example
 * hotelInfoRequestReissueRequest.parse({}); // { emailIt: false }
 */
export const hotelInfoRequestReissueRequest = z
  .object({ emailIt: z.boolean().default(false) })
  .strict();
export type HotelInfoRequestReissueRequest = z.output<typeof hotelInfoRequestReissueRequest>;
export type HotelInfoRequestReissueRequestInput = z.input<typeof hotelInfoRequestReissueRequest>;

/** How staff passed a link on by hand: WhatsApp (by copy or the share sheet), a plain copy, or another way. */
export const hotelInfoRequestShareChannel = z.enum(["whatsapp", "copy", "other"]);
export type HotelInfoRequestShareChannel = z.infer<typeof hotelInfoRequestShareChannel>;

/**
 * A recorded share's note for AMPM: trimmed, 1 to 500 characters, with no pasted link (the Record share
 * form checks it as the API does).
 *
 * @example
 * hotelInfoRequestShareNote.safeParse("To the GM on WhatsApp").success; // true
 */
export const hotelInfoRequestShareNote = linkFree(
  storableText().min(1).max(HOTEL_INFO_REQUEST_SHARE_NOTE_MAX),
);

/**
 * `POST …/:id/share-record`: that the link was shared, and how; the link itself is never sent or stored.
 *
 * @example
 * hotelInfoRequestShareRecordRequest.parse({ channel: "whatsapp" });
 */
export const hotelInfoRequestShareRecordRequest = z
  .object({
    channel: hotelInfoRequestShareChannel,
    note: hotelInfoRequestShareNote.optional(),
  })
  .strict();
export type HotelInfoRequestShareRecordRequest = z.infer<typeof hotelInfoRequestShareRecordRequest>;

/**
 * `POST …/:id/revoke`: the §7 move to revoked, which ends the link; staff give the reason.
 *
 * @example
 * hotelInfoRequestRevokeRequest.parse({ reason: "Sent to the wrong hotel" });
 */
export const hotelInfoRequestRevokeRequest = z.object({ reason: longText }).strict();
export type HotelInfoRequestRevokeRequest = z.infer<typeof hotelInfoRequestRevokeRequest>;

/**
 * `GET /hotels-admin/info-requests`: the inbox, newest first, by cursor; filtered by status and kind, and
 * without test requests unless `includeTests=true`.
 *
 * @example
 * hotelInfoRequestListQuery.parse({ status: "submitted" }); // { status: "submitted", limit: 50, includeTests: false }
 */
export const hotelInfoRequestListQuery = cursorQuery
  .extend({
    cursor: uuid.optional(),
    status: hotelInfoRequestStatus.optional(),
    kind: hotelInfoRequestKind.optional(),
    includeTests: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
  })
  .strict();
export type HotelInfoRequestListQuery = z.output<typeof hotelInfoRequestListQuery>;
export type HotelInfoRequestListQueryInput = z.input<typeof hotelInfoRequestListQuery>;

/** `GET /hotels-admin/hotels/:hotelId/info-requests`: one hotel's requests, newest first, tests included. */
export const hotelInfoRequestHistoryQuery = cursorQuery
  .extend({ cursor: uuid.optional() })
  .strict();
export type HotelInfoRequestHistoryQuery = z.output<typeof hotelInfoRequestHistoryQuery>;

/**
 * `GET /hotels-admin/hotel-duplicate-hints`: what staff typed in the Invite sheet so far. Either may be
 * absent or still incomplete; the hints use what reads as a name or an address. With the destination
 * chosen, the answer also names the live new-hotel requests of the same name there (D-192).
 *
 * @example
 * hotelDuplicateHintsQuery.parse({ name: "Lake Palace", webAddress: "lakepalace.example" });
 */
export const hotelDuplicateHintsQuery = z
  .object({
    name: storableText().max(255).optional(),
    webAddress: storableText().max(2048).optional(),
    destinationId: uuid.optional(),
  })
  .strict();
export type HotelDuplicateHintsQuery = z.infer<typeof hotelDuplicateHintsQuery>;
