import {
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SECTION_DRAFTS,
  hotelFormSectionTooLargeDetails,
  isHotelFormSectionTooLarge,
  type HotelFormSectionAnswers,
  type HotelFormSectionKey,
} from "@ampm/core";
import type { z } from "zod";

import type { SectionPayload } from "./section-autosave";

/*
 * What a section's save sends, checked as the API will check it (D-190 §2 and §3) before anything is
 * sent: the section's own draft (rows' ids each once, chips each once, the row caps) and its byte cap.
 * Over either, the page says why rather than sending a save the API would refuse.
 */

/** Each section's draft, typed so a key's parse gives that section's answers. */
const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

/** A section's save, or why it cannot be sent as it stands. */
export type PayloadCheck<K extends HotelFormSectionKey> =
  | { readonly kind: "send"; readonly payload: SectionPayload<K> }
  | { readonly kind: "refused"; readonly message: string };

/**
 * The save a section's answers make, or the reason the page cannot send it.
 *
 * @example
 * const check = payloadOf("rooms", built.answers, noChanges);
 * if (check.kind === "send") autosave.change(check.payload);
 */
export function payloadOf<K extends HotelFormSectionKey>(
  key: K,
  answers: HotelFormSectionAnswers[K],
  noChanges: boolean,
): PayloadCheck<K> {
  const parsed = DRAFTS[key].safeParse(answers);
  if (!parsed.success)
    return {
      kind: "refused",
      message: parsed.error.issues[0]?.message ?? HOTEL_FORM_ERRORS.sectionTooLarge,
    };
  if (isHotelFormSectionTooLarge(key, parsed.data)) {
    const cap = hotelFormSectionTooLargeDetails(key)[0]?.message ?? "";
    return { kind: "refused", message: `${HOTEL_FORM_ERRORS.sectionTooLarge} ${cap}`.trim() };
  }
  return { kind: "send", payload: { answers: parsed.data, noChanges } };
}
