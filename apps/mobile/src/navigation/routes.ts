import type { PrincipalType } from "@ampm/core";

/** The two audiences of the app: the team (staff workspace) and clients (the client portal). */
export type Audience = "staff" | "client";

/**
 * Whether the pathname is the route or one of the screens under it: "/leads" covers "/leads/123",
 * "/portal" covers "/portal/requests/new". "/leadership" is not under "/leads".
 */
export function isOnRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Staff use the workspace; every other principal the app signs in (client, demo) uses the portal. */
export function audienceOf(principalType: PrincipalType): Audience {
  return principalType === "staff" ? "staff" : "client";
}
