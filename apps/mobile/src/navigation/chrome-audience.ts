import type { PrincipalType } from "@ampm/core";

import { CLIENT_AREAS } from "./client-areas";
import { audienceOf, isOnRoute, type Audience } from "./routes";
import { STAFF_AREAS } from "./staff-areas";

/** The workspace's routes (the areas and their detail screens), and the portal's. */
const AUDIENCE_ROUTES: Record<Audience, readonly string[]> = {
  staff: STAFF_AREAS.map((area) => area.href),
  client: CLIENT_AREAS.flatMap((area) => (area.href ? [area.href] : [])),
};

/**
 * Which navigation a wide window draws around this route for this principal: the staff rail on the
 * workspace's routes, the client top navigation on the portal's, nothing elsewhere (sign-in, the
 * gallery, the entry redirect) or on the other audience's routes. `/account` belongs to both.
 */
export function chromeAudience(pathname: string, principalType: PrincipalType): Audience | null {
  const audience = audienceOf(principalType);
  return AUDIENCE_ROUTES[audience].some((route) => isOnRoute(pathname, route)) ? audience : null;
}
