import {
  hotelFormDesignation,
  hotelFormMeUpdateRequest,
  hotelFormPersonName,
  type HotelFormMeUpdateRequest,
  type HotelFormPerson,
} from "@ampm/core";

import {
  designationOf,
  detailsErrorsOf,
  type DetailsErrors,
  type DetailsFields,
} from "./details.form";

/*
 * Changing your own name and designation on the signed-in page (`PATCH /hotel-form/me`, D-189 §4): only
 * what changed is sent, checked with core's schemas. A new mobile needs a new code, so it is not here.
 */

/** The fields the edit uses: HF-02's, without the mobile and the tick. */
export type PersonFields = Pick<
  DetailsFields,
  "fullName" | "designationChoice" | "designationOther"
>;

/** What pressing Save does with the edit as it stands. */
export type MeChangeStep =
  | { readonly kind: "invalid"; readonly errors: DetailsErrors }
  | { readonly kind: "unchanged" }
  | { readonly kind: "send"; readonly change: HotelFormMeUpdateRequest };

/**
 * The change to send: the name and the designation that differ from the stored ones, each checked as
 * the API checks it; nothing when neither differs.
 *
 * @example
 * meChangeStep(fields, me.person); // { kind: "send", change: { designation: "Director of Sales" } }
 */
export function meChangeStep(fields: PersonFields, person: HotelFormPerson): MeChangeStep {
  const name = hotelFormPersonName.safeParse(fields.fullName);
  const designation = hotelFormDesignation.safeParse(designationOf(fields));
  const issues = [
    ...(name.success ? [] : name.error.issues.map((issue) => ({ ...issue, path: ["fullName"] }))),
    ...(designation.success
      ? []
      : designation.error.issues.map((issue) => ({ ...issue, path: ["designation"] }))),
  ];
  if (issues.length > 0 || !name.success || !designation.success)
    return { kind: "invalid", errors: detailsErrorsOf(issues, fields) };
  const change = {
    ...(name.data === person.fullName ? {} : { fullName: name.data }),
    ...(designation.data === person.designation ? {} : { designation: designation.data }),
  };
  const parsed = hotelFormMeUpdateRequest.safeParse(change);
  return parsed.success ? { kind: "send", change: parsed.data } : { kind: "unchanged" };
}
