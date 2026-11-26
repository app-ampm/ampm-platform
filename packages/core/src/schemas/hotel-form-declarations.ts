import { z } from "zod";

import { isoDateTime, storableJsonText } from "./common";
import { hotelFormRequestStatus } from "./hotel-form";
import { hotelFormSectionVersions } from "./hotel-form-submit-versions";
import { HOTEL_INFO_REQUEST_REFERENCE, hotelInfoRequestConsentKind } from "./hotel-info-requests";

/*
 * DRAFT wording, for counsel's review and AMPM's approval before real hotels use the form (HF-G2;
 * docs/planning/hotel-information-form-wording.md §3 and §4).
 *
 * The two declarations a submit records (D-190 §2 and §3; plan §4.4): 7.4, the accuracy confirmation, a
 * required tick; and 7.5, the display authorisation, an explicit Yes or No that the review page never
 * pre-selects. Each is a consent row bound to the submitted revision's hash, recording the version of the
 * words below; the API refuses a submit naming another version ("The form was updated. Reload the
 * page."), so the words and their version change together, as the privacy notice's do
 * (HOTEL_FORM_NOTICE_VERSION). Then the bodies of submit, of a correction and of a withdrawal, and the
 * withdrawal's answer.
 */

/** The version of 7.4's words, recorded on each `accuracy_attestation` consent. */
export const HOTEL_FORM_ACCURACY_VERSION = "hf-accuracy-2026-11-26";

/** The version of 7.5's words, recorded on each `display_authorisation` consent. */
export const HOTEL_FORM_DISPLAY_VERSION = "hf-display-2026-11-26";

/** 7.4, the accuracy confirmation: the words beside the review page's required tick. */
export const HOTEL_FORM_ACCURACY_DECLARATION = {
  version: HOTEL_FORM_ACCURACY_VERSION,
  statement:
    "I confirm that the information in this form is correct to the best of my knowledge. I am authorised by the hotel to share it, including the work contact details of the people named in it.",
} as const;

/**
 * 7.5, the display authorisation, reworded to promise only what AMPM shows (decision 13): the question,
 * what each answer means, and the two answers.
 */
export const HOTEL_FORM_DISPLAY_AUTHORISATION = {
  version: HOTEL_FORM_DISPLAY_VERSION,
  question: "May AMPM show your hotel's details to its clients?",
  ifYes:
    "If you say Yes, AMPM may show its registered clients the hotel details and photographs that AMPM has reviewed and approved. Menus and price lists stay private to AMPM. Clients see prices only after AMPM has confirmed them with the hotel.",
  ifNo: "If you say No, AMPM uses the information only for its own planning and shows none of your photographs.",
  yes: "Yes",
  no: "No",
} as const;

/**
 * The Turnstile actions of the review page's Submit (HF-06) and of the status page's correction (HF-07):
 * the site draws each widget with its action, and the API refuses a token that names another.
 */
export const HOTEL_FORM_SUBMIT_ACTION = "hf_submit";
export const HOTEL_FORM_CORRECTION_ACTION = "hf_correction";

/** 7.5's answer: `granted` on the consent is true for yes. */
export const hotelFormDisplayAnswer = z.enum(["yes", "no"], { error: "Answer Yes or No" });
export type HotelFormDisplayAnswer = z.infer<typeof hotelFormDisplayAnswer>;

/** A wording's version as the page shows it: compared by the API, at most the column's 64 characters. */
const textVersion = z.string().min(1).max(64);

/** The bot check's pass, as the identity step's: a missing one is refused by the check (400 on it). */
const botToken = z.string().max(4096).optional();

/**
 * `POST /hotel-form/submit`: 7.4 accepted and 7.5 answered, each naming the version of the words the
 * person saw ({@link HOTEL_FORM_ACCURACY_VERSION}, {@link HOTEL_FORM_DISPLAY_VERSION}); every section's
 * version as the review page showed it (`hotelFormSectionVersionsOf(draft.sections)`), so a colleague's
 * later save is 409 `sectionsChanged` rather than declared accurate unseen; and the Turnstile pass for
 * {@link HOTEL_FORM_SUBMIT_ACTION}.
 *
 * @example
 * hotelFormSubmitRequest.parse({
 *   accuracy: { accepted: true, textVersion: HOTEL_FORM_ACCURACY_VERSION },
 *   display: { answer: "no", textVersion: HOTEL_FORM_DISPLAY_VERSION },
 *   sectionVersions: hotelFormSectionVersionsOf(draft.sections),
 *   botToken,
 * });
 */
export const hotelFormSubmitRequest = z
  .object({
    accuracy: z
      .object({
        accepted: z.literal(true, { error: "Confirm that the information is correct" }),
        textVersion,
      })
      .strict(),
    display: z.object({ answer: hotelFormDisplayAnswer, textVersion }).strict(),
    sectionVersions: hotelFormSectionVersions,
    botToken,
  })
  .strict();
export type HotelFormSubmitRequest = z.infer<typeof hotelFormSubmitRequest>;

/** `submit`'s answer, the same for an idempotent repeat: the reference, the status and when. */
export const hotelFormSubmitted = z
  .object({
    reference: z.string().regex(HOTEL_INFO_REQUEST_REFERENCE),
    status: hotelFormRequestStatus,
    submittedAt: isoDateTime,
  })
  .strict();
export type HotelFormSubmitted = z.infer<typeof hotelFormSubmitted>;

/** The longest correction message (`hotel_info_request_corrections.message`, RESTRICTED-CONTACT). */
export const HOTEL_FORM_CORRECTION_MAX = 2_000;

/**
 * `POST /hotel-form/corrections`: a message for AMPM's Hotel team after submitting, read only in the
 * staff app, and the Turnstile pass for {@link HOTEL_FORM_CORRECTION_ACTION}.
 */
export const hotelFormCorrectionRequest = z
  .object({
    message: storableJsonText()
      .min(1, "Write what should be corrected")
      .max(HOTEL_FORM_CORRECTION_MAX, `Use at most ${HOTEL_FORM_CORRECTION_MAX} characters`),
    botToken,
  })
  .strict();
export type HotelFormCorrectionRequest = z.infer<typeof hotelFormCorrectionRequest>;

/** What a withdrawal takes back: 7.5 alone, or every consent the person gave. */
export const hotelFormWithdrawalKind = z.enum(["display_authorisation", "all"]);
export type HotelFormWithdrawalKind = z.infer<typeof hotelFormWithdrawalKind>;

/**
 * `POST /hotel-form/consent-withdrawal`: withdraw the person's live consents of `kind`, and with
 * `requestRemoval` ask for their details to be removed, for a Super Admin to review.
 */
export const hotelFormWithdrawalRequest = z
  .object({ kind: hotelFormWithdrawalKind, requestRemoval: z.boolean() })
  .strict();
export type HotelFormWithdrawalRequest = z.infer<typeof hotelFormWithdrawalRequest>;

/**
 * `consent-withdrawal`'s answer: the kinds of consent this call withdrew (none when the person had no live
 * one of that kind left), and whether the person's details are now asked to be removed, for a Super Admin.
 */
export const hotelFormWithdrawn = z
  .object({ withdrawn: z.array(hotelInfoRequestConsentKind), removalRequested: z.boolean() })
  .strict();
export type HotelFormWithdrawn = z.infer<typeof hotelFormWithdrawn>;
