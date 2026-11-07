import { isOnRoute } from "./routes";

export type ClientAreaKey = "home" | "hotels" | "wedding" | "approvals" | "more";

/** The routes of the client portal's open areas: each is the area's top-level screen. */
export type ClientAreaPath = "/portal" | "/hotels" | "/account";

export interface ClientArea {
  readonly key: ClientAreaKey;
  readonly label: string;
  /** Where the area opens; `null` while it is locked (My Wedding and Approvals until AMPM is appointed). */
  readonly href: ClientAreaPath | null;
}

/**
 * The client app's tabs (P artboards) and, without More, the portal's top navigation (D4, D5).
 * "/portal" holds Home and the hotel requests under it; "/hotels" the search and "My selection".
 */
export const CLIENT_AREAS: readonly ClientArea[] = [
  { key: "home", label: "Home", href: "/portal" },
  { key: "hotels", label: "Hotels", href: "/hotels" },
  { key: "wedding", label: "My Wedding", href: null },
  { key: "approvals", label: "Approvals", href: null },
  { key: "more", label: "More", href: "/account" },
];

/** The toast a locked area shows instead of opening. */
export const LOCKED_AREA_NOTICE = "Opens once AMPM is appointed";

/** The area whose screen is showing, from the path: "/hotels/saved" is in Hotels. */
export function activeClientArea(pathname: string): ClientArea | undefined {
  return CLIENT_AREAS.find((area) => area.href !== null && isOnRoute(pathname, area.href));
}
