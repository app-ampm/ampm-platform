import { Redirect } from "expo-router";

import { useMe } from "@ampm/api-client";

import { useIsSignedIn } from "@/lib/session";
import { staffHomeHref } from "@/navigation/staff-areas";

/**
 * Entry: a signed-in visitor is routed by role — staff to the first workspace area their roles
 * grant (Leads for Sales, Tasks for a role with neither leads nor enquiries), clients to the portal.
 */
export default function IndexRoute() {
  const hasSession = useIsSignedIn();
  if (!hasSession) return <Redirect href="/sign-in" />;
  return <AuthedRedirect />;
}

/** Reads `/me` (always, once signed in) and redirects by principal type and roles. */
function AuthedRedirect() {
  const me = useMe();
  if (me.isPending) return null;
  if (me.isError) return <Redirect href="/sign-in" />;
  return (
    <Redirect href={me.data.principal.type === "staff" ? staffHomeHref(me.data) : "/portal"} />
  );
}
