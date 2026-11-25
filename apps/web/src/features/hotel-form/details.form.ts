import {
  HOTEL_FORM_DESIGNATIONS,
  HOTEL_FORM_NOTICE_VERSION,
  HOTEL_FORM_OTHER_DESIGNATION,
  hotelFormCodeRequest,
  type HotelFormCodeRequest,
  type HotelFormPerson,
} from "@ampm/core";
import type { z } from "zod";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";

/*
 * HF-02's fields and what pressing "Send me a code" does with them (D-175: useState, pure `*.form`
 * helpers and core's schemas). The claim is checked with the very schema the API parses it with, so a
 * field's message is core's, and the request carries the notice version the page showed.
 */

/** What the person types on HF-02, kept as typed across the steps and a new code. */
export interface DetailsFields {
  readonly fullName: string;
  /** One of HOTEL_FORM_DESIGNATIONS, or "" while none is chosen. */
  readonly designationChoice: string;
  /** The words typed after choosing Other. */
  readonly designationOther: string;
  readonly mobile: string;
  readonly noticeAccepted: boolean;
}

/** The fields' errors, keyed as the fields are (and `notice` for the tick). */
export type DetailsErrors = Partial<Record<keyof DetailsFields | "notice", string>>;

export const EMPTY_DETAILS: DetailsFields = {
  fullName: "",
  designationChoice: "",
  designationOther: "",
  mobile: "",
  noticeAccepted: false,
};

/**
 * The designation a claim sends: the chosen one, or the words typed after Other. While none are typed it
 * is Other itself, which core's schema refuses with "Enter your designation".
 *
 * @example
 * designationOf({ ...fields, designationChoice: "Other", designationOther: "Chief Engineer" }); // "Chief Engineer"
 */
export function designationOf(
  fields: Pick<DetailsFields, "designationChoice" | "designationOther">,
) {
  if (fields.designationChoice !== HOTEL_FORM_OTHER_DESIGNATION) return fields.designationChoice;
  const typed = fields.designationOther.trim();
  return typed === "" ? HOTEL_FORM_OTHER_DESIGNATION : fields.designationOther;
}

/** The fields filled with a person's stored name and designation (a new code after a reload). */
export function detailsFromPerson(person: HotelFormPerson, mobile = ""): DetailsFields {
  const isListed = (HOTEL_FORM_DESIGNATIONS as readonly string[]).includes(person.designation);
  return {
    fullName: person.fullName,
    designationChoice: isListed ? person.designation : HOTEL_FORM_OTHER_DESIGNATION,
    designationOther: isListed ? "" : person.designation,
    mobile,
    noticeAccepted: false,
  };
}

/** Core's issues as one message per field, the designation's on the field that holds it. */
export function detailsErrorsOf(
  issues: readonly z.core.$ZodIssue[],
  fields: Pick<DetailsFields, "designationChoice">,
): DetailsErrors {
  const errors: DetailsErrors = {};
  const designationField =
    fields.designationChoice === HOTEL_FORM_OTHER_DESIGNATION
      ? "designationOther"
      : "designationChoice";
  for (const issue of issues) {
    const path = String(issue.path[0] ?? "");
    const field =
      path === "designation"
        ? designationField
        : path === "fullName" || path === "mobile"
          ? path
          : null;
    if (field !== null && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}

/** What pressing "Send me a code" does with the fields as they stand. */
export type DetailsStep =
  | { readonly kind: "invalid"; readonly errors: DetailsErrors }
  | { readonly kind: "wait" }
  | { readonly kind: "send"; readonly request: HotelFormCodeRequest };

/**
 * The answers are checked first, so their errors show whatever the bot check is doing; without the
 * check's token the form waits (its button is disabled then); otherwise the claim goes with the link,
 * the notice version and the token.
 *
 * @example
 * const step = detailsStep(fields, link, botCheck.token);
 */
export function detailsStep(
  fields: DetailsFields,
  link: string,
  botToken: string | null,
): DetailsStep {
  const parsed = hotelFormCodeRequest.safeParse({
    token: link,
    fullName: fields.fullName,
    designation: designationOf(fields),
    mobile: fields.mobile,
    noticeVersion: HOTEL_FORM_NOTICE_VERSION,
    ...(botToken === null ? {} : { botToken }),
  });
  const errors = parsed.success ? {} : detailsErrorsOf(parsed.error.issues, fields);
  if (!fields.noticeAccepted) errors.notice = HOTEL_FORM_COPY.details.noticeRequired;
  if (Object.keys(errors).length > 0) return { kind: "invalid", errors };
  if (!parsed.success || botToken === null) return { kind: "wait" };
  return { kind: "send", request: parsed.data };
}
