import { z } from "zod";

import { isoDateTime, storableText, uuid } from "./common.js";
import { totpCode } from "./sign-in.js";

/*
 * The hotel form's public routes (D-189 §4; plan §4.3 and §7.1): what the site sends to `/hotel-form` and
 * what it gets back. Every body is strict. No answer carries anything about the hotel: before a code,
 * `open` answers the link's state alone; after it, the person's own details and the staff label, note,
 * status and expiry of the request. The refusals (messages and the 401 reasons) are in
 * hotel-form-refusals.ts. Anyone holding the link can call these routes, so a code proves nothing about
 * the mobile while codes are shown on screen.
 */

/**
 * The privacy notice the welcome page (HF-01) shows and the details page's tick (HF-02) accepts. A code
 * request naming another version is refused ("The form was updated. Reload the page."), and the version
 * accepted is recorded with the person's `privacy_notice` consent. Change it whenever the notice's words
 * change.
 */
export const HOTEL_FORM_NOTICE_VERSION = "hf-notice-2026-11-25";

/** The designations the details page offers (D-189 §4), Other last: choosing it asks for the words. */
export const HOTEL_FORM_DESIGNATIONS = [
  "General Manager",
  "Director of Sales",
  "Sales Manager",
  "Revenue Manager",
  "Front Office Manager",
  "Banquet or Events Manager",
  "Other",
] as const;
export type HotelFormDesignationChoice = (typeof HOTEL_FORM_DESIGNATIONS)[number];

/** The choice that asks the person to type their designation; never stored as one. */
export const HOTEL_FORM_OTHER_DESIGNATION = "Other" satisfies HotelFormDesignationChoice;

/** The longest name and designation a person may give. */
export const HOTEL_FORM_NAME_MAX = 120;
export const HOTEL_FORM_DESIGNATION_MAX = 100;

/** What a mobile that is not an Indian one is refused with: codes go to Indian mobiles only. */
export const HOTEL_FORM_MOBILE_REFUSAL =
  "Enter a 10-digit Indian mobile number, such as 98765 43210";

/** What people type between digits: spaces, hyphens, dots and brackets. */
const MOBILE_SEPARATORS = /[\s().-]/g;
/** An Indian mobile in E.164: +91, then ten digits starting 6 to 9. */
const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

/** A typed mobile in E.164 when it reads as an Indian one (ten digits, 0 or 91 before them), else as typed. */
function indianMobileE164(typed: string): string {
  const compact = typed.replace(MOBILE_SEPARATORS, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (!/^\d+$/.test(digits)) return compact;
  if (compact.startsWith("+")) return compact;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return compact;
}

/**
 * The mobile a person gives, written in E.164: an Indian mobile however it is typed (`98765 43210`,
 * `+91-98765-43210`, `098765 43210`), anything else refused with {@link HOTEL_FORM_MOBILE_REFUSAL}.
 *
 * @example
 * hotelFormMobile.parse("+91 70000 01234"); // "+917000001234"
 */
export const hotelFormMobile = z
  .string()
  .max(32, HOTEL_FORM_MOBILE_REFUSAL)
  .transform(indianMobileE164)
  .refine((e164) => INDIAN_MOBILE.test(e164), { error: HOTEL_FORM_MOBILE_REFUSAL });

/** A person's name as they give it: trimmed, 1 to 120 characters. */
export const hotelFormPersonName = storableText()
  .min(1, "Enter your name")
  .max(HOTEL_FORM_NAME_MAX, `Use at most ${HOTEL_FORM_NAME_MAX} characters`);

/**
 * A designation: one of {@link HOTEL_FORM_DESIGNATIONS}, or the words the person typed after choosing
 * Other, trimmed, 1 to 100 characters. Other itself is refused: it says nothing.
 *
 * @example
 * hotelFormDesignation.parse("Chief Engineer"); // "Chief Engineer"
 */
export const hotelFormDesignation = storableText()
  .min(1, "Choose your designation")
  .max(HOTEL_FORM_DESIGNATION_MAX, `Use at most ${HOTEL_FORM_DESIGNATION_MAX} characters`)
  .refine((text) => text.toLowerCase() !== HOTEL_FORM_OTHER_DESIGNATION.toLowerCase(), {
    error: "Enter your designation",
  });

/**
 * The link's secret as the page sends it, in a POST body only (`hfl_…`, from the URL's `#k=`). Any text
 * up to 128 characters: a mangled link is answered as `not_active`, not as a 400.
 */
export const hotelFormLinkToken = z.string().min(1).max(128);

/** A form session's token: `hfs_` and the base64url of 32 random bytes, sent as the Bearer. */
export const hotelFormSessionToken = z.string().regex(/^hfs_[A-Za-z0-9_-]{43}$/);

/** `POST /hotel-form/open`: what state the link is in. */
export const hotelFormOpenRequest = z.object({ token: hotelFormLinkToken }).strict();
export type HotelFormOpenRequest = z.infer<typeof hotelFormOpenRequest>;

/**
 * `POST /hotel-form/codes`: ask for a code. The claim (name, designation, mobile) is held on the code's
 * challenge until the code is entered; nothing a stranger types reaches anyone's record without one.
 * `noticeVersion` must be {@link HOTEL_FORM_NOTICE_VERSION}; `botToken` is the Turnstile pass for action
 * `hf_code` (a missing one is refused by the bot check, 400 on `botToken`).
 */
export const hotelFormCodeRequest = z
  .object({
    token: hotelFormLinkToken,
    fullName: hotelFormPersonName,
    designation: hotelFormDesignation,
    mobile: hotelFormMobile,
    noticeVersion: z.string().min(1).max(64),
    botToken: z.string().max(4096).optional(),
  })
  .strict();
export type HotelFormCodeRequest = z.output<typeof hotelFormCodeRequest>;
export type HotelFormCodeRequestInput = z.input<typeof hotelFormCodeRequest>;

/** `POST /hotel-form/codes/verify`: the code of one challenge, on the link it was issued for. */
export const hotelFormVerifyRequest = z
  .object({ token: hotelFormLinkToken, challengeId: uuid, oneTimeCode: totpCode })
  .strict();
export type HotelFormVerifyRequest = z.infer<typeof hotelFormVerifyRequest>;

/** `PATCH /hotel-form/me`: your own name or designation, or both. A new mobile needs a new code. */
export const hotelFormMeUpdateRequest = z
  .object({
    fullName: hotelFormPersonName.optional(),
    designation: hotelFormDesignation.optional(),
  })
  .strict()
  .refine((body) => body.fullName !== undefined || body.designation !== undefined, {
    error: "Change your name or your designation",
  });
export type HotelFormMeUpdateRequest = z.infer<typeof hotelFormMeUpdateRequest>;

/**
 * What a link opens to: `ready` (open, or changes requested: the form can be filled in); `locked`
 * (submitted or in review: the status only); `status_only` (merged, inside the window after the merge);
 * `not_active` (unknown, expired, revoked, rejected, its hotel deleted, or not admitted by the form's
 * mode). HF-08 shows `not_active` with AMPM's help contact.
 */
export const hotelFormLinkState = z.enum(["ready", "locked", "status_only", "not_active"]);
export type HotelFormLinkState = z.infer<typeof hotelFormLinkState>;

/**
 * `open`'s answer: the state, when the link stops working (null when `not_active`) and AMPM's help
 * contact (null until a Super Admin sets `hotel_form.policy.helpContact`). Nothing about the hotel.
 */
export const hotelFormOpenAnswer = z
  .object({
    state: hotelFormLinkState,
    expiresAt: isoDateTime.nullable(),
    helpContact: z.string().nullable(),
  })
  .strict();
export type HotelFormOpenAnswer = z.infer<typeof hotelFormOpenAnswer>;

const codeIssuedFields = {
  challengeId: uuid,
  /** "+91 ••••• •1234": enough to recognise the number. */
  maskedMobile: z.string().min(1),
  /** When this code stops working (5 minutes). */
  expiresAt: isoDateTime,
  /** The earliest another code may be asked for (30 seconds); sooner is a 429 with Retry-After. */
  resendAfter: isoDateTime,
};

/**
 * `codes`' answer. In SMS mode (`delivery: "sms"`) the code went by text message and is never here; in
 * on-screen mode (`"screen"`, until an SMS provider and the form's template are set) `code` is the code
 * itself, for the page to show in a callout as client sign-in does.
 */
export const hotelFormCodeIssued = z.discriminatedUnion("delivery", [
  z.object({ ...codeIssuedFields, delivery: z.literal("sms") }).strict(),
  z.object({ ...codeIssuedFields, delivery: z.literal("screen"), code: totpCode }).strict(),
]);
export type HotelFormCodeIssued = z.infer<typeof hotelFormCodeIssued>;

/** The statuses a signed-in person can see: any other is `not_active`, and no session passes then. */
export const hotelFormRequestStatus = z.enum([
  "open",
  "submitted",
  "in_review",
  "changes_requested",
  "merged",
]);
export type HotelFormRequestStatus = z.infer<typeof hotelFormRequestStatus>;

/**
 * The page's state for a status a signed-in person can see.
 *
 * @example
 * hotelFormStateOf(me.request.status); // "ready" | "locked" | "status_only"
 */
export function hotelFormStateOf(
  status: HotelFormRequestStatus,
): Exclude<HotelFormLinkState, "not_active"> {
  if (status === "open" || status === "changes_requested") return "ready";
  return status === "merged" ? "status_only" : "locked";
}

/** The signed-in person: their own name and designation, never their mobile. */
export const hotelFormPerson = z.object({ fullName: z.string(), designation: z.string() }).strict();
export type HotelFormPerson = z.infer<typeof hotelFormPerson>;

/**
 * The request as a signed-in person sees it: AMPM's label and note, the status, and when the link stops
 * working (the end of the status-only window once merged).
 */
export const hotelFormRequestView = z
  .object({
    displayLabel: z.string().nullable(),
    staffNote: z.string().nullable(),
    status: hotelFormRequestStatus,
    expiresAt: isoDateTime,
  })
  .strict();
export type HotelFormRequestView = z.infer<typeof hotelFormRequestView>;

/** `GET` and `PATCH /hotel-form/me`'s answer. */
export const hotelFormMe = z
  .object({ person: hotelFormPerson, request: hotelFormRequestView })
  .strict();
export type HotelFormMe = z.infer<typeof hotelFormMe>;

/**
 * `codes/verify`'s answer: the session token (kept in sessionStorage, sent as `Authorization: Bearer`),
 * with the person and the request as `me` answers them.
 */
export const hotelFormVerified = hotelFormMe
  .extend({ sessionToken: hotelFormSessionToken })
  .strict();
export type HotelFormVerified = z.infer<typeof hotelFormVerified>;
