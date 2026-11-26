import { HOTEL_FORM_SECTION_KEYS, hotelFormSectionKey, type HotelFormSectionKey } from "@ampm/core";

/*
 * Where the hotel form's pages live (D-190 §5; plan §4.4): the sign-in at /hotel-form, then the overview
 * (HF-04), a page per section (HF-05), review and submit (HF-06) and the status (HF-07), all under the
 * form's own headers and CSP (middleware.ts). A page behind the sign-in that is opened without a session
 * sends the person to the sign-in and is returned to afterwards; only these pages may be returned to.
 */

export const HOTEL_FORM_ROUTES = {
  identity: "/hotel-form",
  overview: "/hotel-form/overview",
  review: "/hotel-form/review",
  status: "/hotel-form/status",
} as const;

/**
 * A section's page.
 *
 * @example
 * sectionPath("rooms"); // "/hotel-form/sections/rooms"
 */
export function sectionPath(key: HotelFormSectionKey): string {
  return `/hotel-form/sections/${key}`;
}

/**
 * The section a page's address names, or null for any other word (the page is then not found).
 *
 * @example
 * sectionKeyOf("venues"); // "venues"
 */
export function sectionKeyOf(param: string): HotelFormSectionKey | null {
  const parsed = hotelFormSectionKey.safeParse(param);
  return parsed.success ? parsed.data : null;
}

/**
 * The section after this one in the form's order, or null after the last (then Review and submit).
 *
 * @example
 * nextSectionOf("rooms"); // "venues"
 */
export function nextSectionOf(key: HotelFormSectionKey): HotelFormSectionKey | null {
  return HOTEL_FORM_SECTION_KEYS[HOTEL_FORM_SECTION_KEYS.indexOf(key) + 1] ?? null;
}

const INNER_PAGES: ReadonlySet<string> = new Set([
  HOTEL_FORM_ROUTES.overview,
  HOTEL_FORM_ROUTES.review,
  HOTEL_FORM_ROUTES.status,
  ...HOTEL_FORM_SECTION_KEYS.map(sectionPath),
]);

/**
 * A page behind the sign-in, exactly as one of the form's own, or null: the only places the sign-in sends
 * a person back to, so nothing typed or linked can send them elsewhere.
 *
 * @example
 * innerPathOf("/hotel-form/sections/rooms"); // "/hotel-form/sections/rooms"
 * innerPathOf("//elsewhere.example"); // null
 */
export function innerPathOf(path: string | null): string | null {
  return path !== null && INNER_PAGES.has(path) ? path : null;
}
