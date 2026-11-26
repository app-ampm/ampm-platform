import { z } from "zod";

/*
 * India's states and union territories (D-190 §2), as the hotel form's state question offers them and the
 * catalogue's `state` columns spell them ("Rajasthan", "Goa"). The names in use since the reorganisations
 * of 2019 and 2020: Jammu and Kashmir and Ladakh as union territories, and Dadra and Nagar Haveli joined
 * with Daman and Diu. A change of name or a new state is a new entry here; a stored answer keeps its name.
 */

/** India's 8 union territories, in alphabetical order. */
export const INDIAN_UNION_TERRITORIES = [
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

/**
 * India's 28 states and 8 union territories ({@link INDIAN_UNION_TERRITORIES}), in one alphabetical list,
 * for a state picker.
 *
 * @example
 * INDIAN_STATES.includes("Rajasthan"); // true
 */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;
export type IndianState = (typeof INDIAN_STATES)[number];

/**
 * A state or union territory, exactly as {@link INDIAN_STATES} spells it.
 *
 * @example
 * indianState.parse("Goa"); // "Goa"
 */
export const indianState = z.enum(INDIAN_STATES, { error: "Choose the state from the list" });

/**
 * Whether text is a name from {@link INDIAN_STATES}, exactly as written.
 *
 * @example
 * isIndianState("Kerala"); // true
 * isIndianState("Orissa"); // false: Odisha since 2011
 */
export function isIndianState(text: string): text is IndianState {
  return INDIAN_STATES.some((name) => name === text);
}
