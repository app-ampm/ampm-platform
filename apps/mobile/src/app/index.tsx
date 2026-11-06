import { Redirect } from "expo-router";

import { useMe } from "@ampm/api-client";

import { isSignedIn } from "@/lib/session";

/** Entry: a signed-in visitor is routed by role — staff to the Sales workspace, clients to the portal. */
export default function IndexRoute() {
  if (!isSignedIn()) return <Redirect href="/sign-in" />;
  return <AuthedRedirect />;
}

/** Reads `/me` (always, once signed in) and redirects by principal type. */
function AuthedRedirect() {
  const me = useMe();
  if (me.isPending) return null;
  if (me.isError) return <Redirect href="/sign-in" />;
  return <Redirect href={me.data.principal.type === "staff" ? "/leads" : "/portal"} />;
}
